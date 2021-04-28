import {API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service} from 'homebridge';
import Debug from "debug";
import NeatoApi from "node-botvac";
import {PLATFORM_NAME, PLUGIN_NAME} from './settings';
import {NeatoVacuumRobotAccessory} from './accessories/NeatoVacuumRobot';

const debug = Debug("homebridge-neato");

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
		this.log.debug('Finished initializing platform:', this.config.name);

		this.api.on('didFinishLaunching', () => {
			log.debug('Executed didFinishLaunching callback');
			this.discoverRobots();
		});
	}

	/**
	 * This function is invoked when homebridge restores cached accessories from disk at startup.
	 * It should be used to setup event handlers for characteristics and update respective values.
	 */
	configureAccessory(accessory: PlatformAccessory)
	{
		this.log.info('Loading accessory from cache:', accessory.displayName);

		// add the restored accessory to the accessories cache so we can track if it has already been registered
		this.robotAccessories.push(accessory);
	}

	discoverRobots()
	{
		debug("Discovering new robots");
		let client = new NeatoApi.Client();

		// Login
		client.authorize((this.config)['email'], (this.config)['password'], false, (error) => {
			if (error)
			{
				this.log.error("Can't log on to neato cloud. Please check your internet connection and your credentials. Try again later if the neato servers have issues: " + error);
				return;
			}
			else
			{
				// Get all robots
				client.getRobots((error, robots) => {
					if (error)
					{
						this.log.error("Successful login but can't connect to your neato robot: " + error);
						return;
					}
					else if (robots.length === 0)
					{
						this.log.error("Successful login but no robots associated with your account.");
						return;
					}
					else
					{
						debug("Found " + robots.length + " robots");
						let loadedRobots = 0;

						robots.forEach((robot) => {
							// Get additional information for the robot
							robot.getState((error, state) => {
								if (error)
								{
									this.log.error("Error getting robot meta information: " + error + ": " + state);
									return;
								}
								else
								{
									const uuid = this.api.hap.uuid.generate(robot._serial);
									const existingAccessory = this.robotAccessories.find(accessory => accessory.UUID === uuid);

									if (existingAccessory)
									{
										// the accessory already exists
										this.log.info('Restoring existing accessory from cache:', existingAccessory.displayName);

										// TODO update maps

										// if you need to update the accessory.context then you should run `api.updatePlatformAccessories`. eg.:
										// existingAccessory.context.device = device;
										// this.api.updatePlatformAccessories([existingAccessory]);

										// create the accessory handler for the restored accessory
										// this is imported from `platformAccessory.ts`
										new NeatoVacuumRobotAccessory(this, existingAccessory, false);

										// it is possible to remove platform accessories at any time using `api.unregisterPlatformAccessories`, eg.:
										// remove platform accessories when no longer present
										// this.api.unregisterPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [existingAccessory]);
										// this.log.info('Removing existing accessory from cache:', existingAccessory.displayName);
									}
									else
									{
										this.log.info('Adding new accessory: ', robot.name);
										const accessory = new this.api.platformAccessory(robot.name, uuid);

										accessory.context.robot = robot;
										new NeatoVacuumRobotAccessory(this, accessory, true);

										// link the accessory to your platform
										this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [accessory]);
										// TODO get maps
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
								}
							});
						});
					}
				});
			}
		});
	}
}
