import {API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service} from "homebridge";
import NeatoApi from "node-botvac";
import {PLATFORM_NAME, PLUGIN_NAME} from "./settings";
import {NeatoVacuumRobotAccessory} from "./accessories/NeatoVacuumRobot";

/**
 * HomebridgePlatform
 * This class is the main constructor for your plugin, this is where you should
 * parse the user config and discover/register accessories with Homebridge.
 */
export class HomebridgeNeatoPlatform implements DynamicPlatformPlugin
{
	public readonly Service: typeof Service = this.api.hap.Service;
	public readonly Characteristic: typeof Characteristic = this.api.hap.Characteristic;

	// this is used to track restored cached accessories
	public readonly cachedRobotAccessories: PlatformAccessory[] = [];

	constructor(
			public readonly log: Logger,
			public readonly config: PlatformConfig,
			public readonly api: API)
	{
		this.api.on("didFinishLaunching", () => {
			this.discoverRobots();
		});
	}

	/**
	 * This function is invoked when homebridge restores cached accessories from disk at startup.
	 * It should be used to setup event handlers for characteristics and update respective values.
	 */
	configureAccessory(accessory: PlatformAccessory)
	{
		// add the restored accessory to the accessories cache so we can track if it has already been registered
		this.cachedRobotAccessories.push(accessory);
	}

	
	discoverRobots()
	{
		const client = new NeatoApi.Client();

		try
		{
			// Login
			client.authorize((this.config)["email"], (this.config)["password"], false, (error) => {
				if (error)
				{
					this.log.error("Cannot connect to neato server. No new robots will be found and existing robots will be unresponsive. Retrying in 5 minutes.");
					this.log.error("Error: " + error);

					setTimeout(() => {
						this.discoverRobots();
					}, 5 * 60 * 1000);
					return;
				}

				// Get all robots from account
				client.getRobots((error, robots) => {
					if (error)
					{
						this.log.error("Successful login but can't list the robots in your neato robots. Retrying in 5 minutes.");
						this.log.error("Error: " + error);

						setTimeout(() => {
							this.discoverRobots();
						}, 5 * 60 * 1000);
						return;
					}

					// Neato robots in account
					if (robots.length === 0)
					{
						this.log.error("Neato account has no robots. Did you add your robot here: https://neatorobotics.com/my-neato/ ?");
					}
					else
					{
						this.log.info("Neato account has " + robots.length + " robot" + (robots.length === 1 ? "" : "s"));
					}

					// Neato robots in cache
					this.log.debug("Plugin Cache has " + this.cachedRobotAccessories.length + " robot" + (this.cachedRobotAccessories.length === 1 ? "" : "s"));
					for (let cachedRobot of this.cachedRobotAccessories)
					{
						let accountRobot = robots.find(robot => this.api.hap.uuid.generate(robot._serial) === cachedRobot.UUID);
						if (accountRobot)
						{
							this.log.debug("[" + cachedRobot.displayName + "] Cached robot found in Neato account.");
						}
						else
						{
							this.log.error("[" + cachedRobot.displayName + "] Cached robot not found in Neato account. Robot will now be removed from homebridge.");
							this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [cachedRobot]);
						}
					}

					// Add / Update homebridge accessories with robot information from neato. This must be done for new and existing robots to reflect changes in the name, firmware, pluginconfig etc.
					for (let robot of robots)
					{
						// Check if robot already exists as an accessory
						const uuid = this.api.hap.uuid.generate(robot._serial);
						const cachedRobot = this.cachedRobotAccessories.find(accessory => accessory.UUID === uuid);

						if (cachedRobot)
						{
							this.log.debug("[" + robot.name + "] Connecting to cached robot and updating information.");
						}
						else
						{
							this.log.debug("[" + robot.name + "] Connecting to new robot and updating information.");
						}

						robot.getState((error, state) => {
							if (error)
							{
								this.log.error("[" + robot.name + "] Cannot connect to robot. Is the robot connected to the internet? Retrying in 5 minutes.");
								this.log.error("Error: " + error);
								setTimeout(() => {
									this.discoverRobots();
								}, 5 * 60 * 1000);
							}
							else
							{
								try
								{
									robot.meta = state.meta;
									robot.availableServices = state.availableServices;

									// Update existing robot accessor
									if (cachedRobot)
									{
										// TODO update maps

										cachedRobot.context.robot = robot;
										this.api.updatePlatformAccessories([cachedRobot]);
										new NeatoVacuumRobotAccessory(this, cachedRobot, this.config);
										this.log.info("[" + robot.name + "] Successfully loaded robot from cache");
									}
									// Create new robot accessory
									else
									{
										// TODO get maps

										const newRobot = new this.api.platformAccessory(robot.name, uuid);
										newRobot.context.robot = robot;
										new NeatoVacuumRobotAccessory(this, newRobot, this.config);
										this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newRobot]);
										this.log.info("[" + robot.name + "] Successfully created as new robot");
									}
								}
								catch (error)
								{
									this.log.error("[" + robot.name + "] Creating accessory failed. Error: " + error);
									throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
								}
							}

							// // Get all maps for each robot
							// robot.getPersistentMaps((error, maps) => {
							// 	if (error)
							// 	{
							// 		this.log.error("Error updating persistent maps: " + error + ": " + maps);
							// 		callback();
							// 	}
							// 	// Robot has no maps
							// 	else if (maps.length === 0)
							// 	{
							// 		robot.maps = [];
							// 		this.robotAccessories.push({device: robot, meta: state.meta, availableServices: state.availableServices});
							// 		loadedRobots++;
							// 		if (loadedRobots === robots.length)
							// 		{
							// 			callback();
							// 		}
							// 	}
							// 	// Robot has maps
							// 	else
							// 	{
							// 		robot.maps = maps;
							// 		let loadedMaps = 0;
							// 		robot.maps.forEach((map) => {
							// 			// Save zones in each map
							// 			robot.getMapBoundaries(map.id, (error, result) => {
							// 				if (error)
							// 				{
							// 					this.log.error("Error getting boundaries: " + error + ": " + result)
							// 				}
							// 				else
							// 				{
							// 					map.boundaries = result.boundaries;
							// 				}
							// 				loadedMaps++;
							//
							// 				// Robot is completely requested if zones for all maps are loaded
							// 				if (loadedMaps === robot.maps.length)
							// 				{
							// 					this.robotAccessories.push({device: robot, meta: state.meta, availableServices: state.availableServices});
							// 					loadedRobots++;
							// 					if (loadedRobots === robots.length)
							// 					{
							// 						callback();
							// 					}
							// 				}
							// 			})
							// 		});
							// 	}
							// });
						});
					}
				});
			});
		}
		catch (error)
		{
			this.log.error("Can't log on to neato cloud. Please check your internet connection and your credentials. Try again later if the neato servers have issues. Error: " + error);
		}
	}
}
