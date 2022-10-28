import {API, Characteristic, DynamicPlatformPlugin, Logger, PlatformAccessory, PlatformConfig, Service} from "homebridge";
import NeatoApi from "node-botvac";
import {PLATFORM_NAME, PLUGIN_NAME} from "./settings";
import {VacuumRobotAccessory} from "./accessories/vacuumRobotAccessory";
import {RoomRobotAccessory} from "./accessories/roomRobotAccessory";

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
			this.discoverRobots().then();
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

	async discoverRobots()
	{
		const client = new NeatoApi.Client();
		let robots;

		// Login
		try
		{
			await new Promise((resolve, reject) => {
				client.authorize((this.config)["email"], (this.config)["password"], false, (err, data) => {
					if (err) return reject(err)
					resolve(data)
				})
			});
		}
		catch (error)
		{
			this.log.error("Cannot connect to neato server. No new robots will be found and existing robots will be unresponsive. Retrying in 5 minutes.");
			this.log.error("Error: " + error);

			setTimeout(() => {
				this.discoverRobots();
			}, 5 * 60 * 1000);
			return;
		}

		// Get all robots from account
		try
		{
			await new Promise((resolve, reject) => {
				client.getRobots((err, data) => {
					if (err) return reject(err)
					resolve(data)
				})
			}).then(result => {
				robots = result
			});
		}
		catch (error)
		{
			this.log.error("Successful login but can't list the robots in your neato robots. Retrying in 5 minutes.");
			this.log.error("Error: " + error);

			setTimeout(() => {
				this.discoverRobots();
			}, 5 * 60 * 1000);
			return;
		}

		// Count Neato robots in account
		if (robots.length === 0)
		{
			this.log.error("Neato account has no robots. Did you add your robot here: https://neatorobotics.com/my-neato/ ?");
		}
		else
		{
			this.log.info("Neato account has " + robots.length + " robot" + (robots.length === 1 ? "" : "s"));
		}

		// Count Neato robots in cache
		let robotSize = this.cachedRobotAccessories.filter(r => r.context.room === undefined).length;
		let roomSize = this.cachedRobotAccessories.filter(r => r.context.room !== undefined).length;
		this.log.debug("Plugin cache has " + robotSize + " robot" + (robotSize === 1 ? "" : "s") + " and " + roomSize + " room" + (roomSize === 1 ? "." : "s."));

		// Look for all account robots in cache
		for (let robot of robots)
		{
			this.log.debug("[" + robot.name + "] Found robot.");
			let uuid = this.api.hap.uuid.generate(robot._serial);
			let cachedRobot = this.cachedRobotAccessories.find(r => uuid === r.UUID);
			if (cachedRobot)
			{
				cachedRobot.context.found = true;
			}

			let state;

			try
			{
				await new Promise((resolve, reject) => {
					robot.getState((err, data) => {
						if (err) return reject(err)
						resolve(data)
					})
				}).then(data => {
					state = data;
				});
			}
			catch (error)
			{
				this.log.error("[" + robot.name + "] Cannot connect to robot. Is the robot connected to the internet? Retrying in 5 minutes.");
				this.log.error("Error: " + error);
				setTimeout(() => {
					this.discoverRobots();
				}, 5 * 60 * 1000);
				continue;
			}

			try
			{
				robot.meta = state.meta;
				robot.availableServices = state.availableServices;

				// Update existing robot accessory
				if (cachedRobot)
				{
					this.log.info("[" + robot.name + "] Loaded robot " + robot.name + " from cache.");

					await this.loadFloorplans(robot);

					for (const floorplan of robot.maps)
					{
						await this.loadRooms(robot, floorplan)
					}

					cachedRobot.context.robot = robot;
					this.api.updatePlatformAccessories([cachedRobot]);
					new VacuumRobotAccessory(this, cachedRobot, this.config);
					this.log.info("[" + robot.name + "] Updated robot " + robot.name + " from neato account.");
				}
				// Create new robot accessory
				else
				{
					await this.loadFloorplans(robot);

					for (const floorplan of robot.maps)
					{
						await this.loadRooms(robot, floorplan)
					}

					const newRobot = new this.api.platformAccessory(robot.name, uuid);
					newRobot.context.robot = robot;
					new VacuumRobotAccessory(this, newRobot, this.config);
					this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newRobot]);
					this.log.info("[" + robot.name + "] Added new robot from neato account.");
				}
			}
			catch (error)
			{
				this.log.error("[" + robot.name + "] Creating accessory failed. Error: " + error);
				throw new this.api.hap.HapStatusError(this.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}

		}

		// delete all not found cached accessories;
		for (let i = this.cachedRobotAccessories.length - 1; i >= 0; --i)
		{
			let accessory = this.cachedRobotAccessories[i];
			if (!accessory.context.found)
			{
				if (accessory.context.room === undefined)
				{
					this.log.error("[" + accessory.displayName + "] Cached robot not found in neato account, deleting from cache.");
				}
				else
				{
					this.log.error("[" + accessory.displayName + "] Cached room not found in neato account, deleting from cache.");
				}
				this.cachedRobotAccessories.splice(i, 1);
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
	}

	async loadFloorplans(robot)
	{
		try
		{
			await new Promise((resolve, reject) => {
				robot.getPersistentMaps((err, data) => {
					if (err) return reject(err)
					resolve(data)
				})
			}).then(data => {
				robot.maps = data;
			});
		}
		catch (error)
		{
			this.log.error("[" + robot.name + "] Error loading floorplans from robot.");
			this.log.error("Error: " + error);
		}
	}

	async loadRooms(robot, floorplan)
	{
		this.log.debug("[" + robot.name + "] Found floorplan " + floorplan.name.trim() + ".");

		// Get Boundaries for each map
		try
		{
			await new Promise((resolve, reject) => {
				robot.getMapBoundaries(floorplan.id, (err, data) => {
					if (err) return reject(err)
					resolve(data)
				})
			}).then((data: any) => {
				floorplan.boundaries = data['boundaries'];
				floorplan.boundaries.push({
					id: "098F6BCD4621D373CADE4E832627B4F6",
					name: "Test room 1",
					type: "polygon",
					enabled: true
				});
				floorplan.boundaries.push({
					id: "098F6BCD4621D373CAAA4E832627B4F6",
					name: "Test room 2",
					type: "polygon",
					enabled: true
				});
				let rooms = floorplan.boundaries.filter(r => r.type === "polygon");
				this.log.debug("[" + robot.name + "] Found " + rooms.length + " room" + (rooms.length === 1 ? "" : "s") + " in floorplan " + floorplan.name.trim() + ".");
				for (const room of rooms)
				{
					let uuid = this.api.hap.uuid.generate(room.id);
					let cachedRoom = this.cachedRobotAccessories.find(r => uuid === r.UUID);
					if (cachedRoom)
					{
						cachedRoom.context.found = true;
						this.log.info("[" + robot.name + "] Loaded room " + room.name + " from cache.");
					}
					else
					{
						const newRoom = new this.api.platformAccessory(room.name, uuid);
						newRoom.context.room = room;
						new RoomRobotAccessory(this, newRoom, this.config);
						this.api.registerPlatformAccessories(PLUGIN_NAME, PLATFORM_NAME, [newRoom]);
						this.log.info("[" + robot.name + "] Added room " + room.name + ".");
					}
				}
			});
		}
		catch (error)
		{
			this.log.error("[" + robot.name + "] Error loading rooms for floorplan " + floorplan.name.trim());
			this.log.error("Error: " + error);
		}
	}
}
