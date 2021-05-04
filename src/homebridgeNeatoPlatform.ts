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
	public readonly robotAccessories: PlatformAccessory[] = [];

	constructor(
			public readonly log: Logger,
			public readonly config: PlatformConfig,
			public readonly api: API)
	{
		this.api.on("didFinishLaunching", () =>
		{
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
		this.robotAccessories.push(accessory);
	}

	discoverRobots()
	{
		const client = new NeatoApi.Client();

		try
		{
			// Login
			client.authorize((this.config)["email"], (this.config)["password"], false, (error) =>
			{
				if (error)
				{
					this.log.warn("Cannot connect to neato server. No new robots will be found and existing robots will be unresponsive.");
					this.log.warn(error);
					// TODO retry after x min
					return;
				}

				// Get all robots from account
				client.getRobots((error, robots) =>
				{
					if (error)
					{
						this.log.error("Successful login but can't connect to your neato robot: " + error);
						// TODO retry after x min
						return;
					}
					else if (robots.length === 0)
					{
						this.log.error("Successful login but no robots associated with your account.");
						// TODO retry after x min
						return;
					}

					this.log.info("Neato account has " + robots.length + " robot " + (robots.length === 1 ? "" : "s"));

					for (const robot of robots)
					{
						// Get additional information for the robot
						robot.getState((error, state) =>
						{
							if (error)
							{
								this.log.error("Error getting robot meta information: " + error + ": " + state);
								return;
							}

							try
							{
								robot.meta = state.meta;

								const uuid = this.api.hap.uuid.generate(robot._serial);
								const existingAccessory = this.robotAccessories.find(accessory => accessory.UUID === uuid);

								// the accessory already exists
								if (existingAccessory)
								{
									this.log.info("[" + robot.name + "] Robot loaded from cache");
									// TODO update maps

									existingAccessory.context.robot = robot;
									this.api.updatePlatformAccessories([existingAccessory]);

									new NeatoVacuumRobotAccessory(this, existingAccessory, this.config);
								}
								else
								{
									this.log.info("[" + robot.name + "] Robot created");
									const accessory = new this.api.platformAccessory(robot.name, uuid);

									accessory.context.robot = robot;
									new NeatoVacuumRobotAccessory(this, accessory, this.config);

									// link the accessory to your platform
									this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
									// TODO get maps
								}
							}
							catch (error)
							{
								this.log.error("Error creating robot accessory: " + robot.name);
								this.log.error(error);
								throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
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
			this.log.error("Can't log on to neato cloud. Please check your internet connection and your credentials. Try again later if the neato servers have issues: " + error);
		}
	}
}
