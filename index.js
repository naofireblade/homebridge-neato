"use strict";
let debug = require('debug')('homebridge-neato'),
	botvac = require('node-botvac'),

	Service,
	Characteristic,
	NeatoVacuumRobotAccessory;

module.exports = function (homebridge)
{
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	NeatoVacuumRobotAccessory = require('./accessories/neatoVacuumRobot')(Service, Characteristic);
	homebridge.registerPlatform("homebridge-neato", "NeatoVacuumRobot", NeatoVacuumRobotPlatform);
};

function NeatoVacuumRobotPlatform(log, config)
{
	this.log = log;
	this.serial = "1-3-3-7";
	this.email = config['email'];
	this.password = config['password'];
	this.hiddenServices = '';
	this.hiddenServices = ('disabled' in config ? config['disabled'] : this.hiddenServices);
	this.hiddenServices = ('hidden' in config ? config['hidden'] : this.hiddenServices);

	// Array of real robots and associated robot accessories (incl rooms)
	this.robots = [];
	this.nextRoom = null;

	if ('refresh' in config && config['refresh'] !== 'auto')
	{
		// parse config parameter
		this.refresh = parseInt(config['refresh']);
		// must be integer and positive
		this.refresh = (typeof this.refresh !== 'number' || (this.refresh % 1) !== 0 || this.refresh < 0) ? 60 : this.refresh;
		// minimum 60s to save some load on the neato servers
		if (this.refresh > 0 && this.refresh < 60)
		{
			this.log.warn("Minimum refresh time is 60 seconds to not overload the neato servers");
			this.refresh = (this.refresh > 0 && this.refresh < 60) ? 60 : this.refresh;
		}
	}
	// default auto
	else
	{
		this.refresh = 'auto';
	}
	this.log.info("Refresh is set to: " + this.refresh + (this.refresh !== 'auto' ? ' seconds' : ''));
}

NeatoVacuumRobotPlatform.prototype = {
	accessories: function (callback)
	{
		debug("Creating accessories");
		let accessories = [];
		this.boundaryNames = [];

		this.getRobots((error) =>
		{
			if (error)
			{
				throw new Error("Error init robots");
			}
			else
			{
				for (let i = 0; i < this.robots.length; i++)
				{
					let robot = this.robots[i];
					this.log.info("Found robot #" + (i + 1) + " named \"" + robot.device.name + "\" with serial \"" + robot.device._serial.substring(0, 9) + "XXXXXXXXXXXX\"");

					let mainAccessory = new NeatoVacuumRobotAccessory(this, robot);
					accessories.push(mainAccessory);

					robot.mainAccessory = mainAccessory;
					robot.roomAccessories = [];

					// Start Update Intervall
					this.updateRobotTimer(robot.device._serial);

					if (robot.device.maps)
					{
						for (let j = 0; j < robot.device.maps.length; j++)
						{
							let map = robot.device.maps[j];
							if (map.boundaries)
							{
								for (let k = 0; k < map.boundaries.length; k++)
								{
									let boundary = map.boundaries[k];
									if (boundary.type === "polygon")
									{
										robot.boundary = boundary;
										let roomAccessory = new NeatoVacuumRobotAccessory(this, robot);
										accessories.push(roomAccessory);

										robot.roomAccessories.push(roomAccessory);
									}
								}
							}
						}
					}
				}
				callback(accessories);
			}
		});
	},

	getRobots: function (callback)
	{
		debug("Getting robots");
		let client = new botvac.Client();

		// Login
		client.authorize(this.email, this.password, false, (error) =>
		{
			if (error)
			{
				this.log.error("Can't log in to neato cloud. Please check your internet connection and your credentials. Try again later if the neato servers have issues.");
				callback(true);
			}
			else
			{
				// Get all robots
				client.getRobots((error, robots) =>
				{
					if (error)
					{
						this.log.error("Successful login but can't connect to your neato robot: " + error);
						callback();
					}
					else if (robots.length === 0)
					{
						this.log.error("Successful login but no robots associated with your account.");
						this.robots = [];
						callback();
					}
					else
					{
						debug("Found %s robots in account", robots.length);
						let loadedRobots = 0;

						robots.forEach((robot) =>
						{
							debug("Processing robot %s", robot.name);
							debug("Getting meta information for robot %s", robot.name);
							robot.getState((error, state) =>
							{
								if (error)
								{
									this.log.warn("Cannot get meta information for robot %s. Maybe a non smart robot. Message: %s", robot.name, error);
									this.checkDone(loadedRobots, robots.length, callback);
								}
								else
								{
									debug("Getting zone cleaning maps for robot %s", robot.name);
									robot.getPersistentMaps((error, maps) =>
									{
										if (error)
										{
											this.log.error("Error getting zone cleaning maps: " + error + ": " + maps);
											this.checkDone(loadedRobots, robots.length, callback);
										}
										// Robot has no maps
										else if (maps.length === 0)
										{
											debug("Robot %s has no zone cleaning maps", robot.name);
											robot.maps = [];
											this.robots.push({device: robot, meta: state.meta, availableServices: state.availableServices});
											this.checkDone(loadedRobots, robots.length, callback);
										}
										// Robot has maps
										else
										{
											debug("Robot %s has %s zone cleaning maps", robot.name, maps.length);
											robot.maps = maps;
											let loadedMaps = 0;
											robot.maps.forEach((map) =>
											{
												debug("Processing zone cleaning map %s of robot %s", map.id, robot.name);
												robot.getMapBoundaries(map.id, (error, result) =>
												{

													if (error)
													{
														this.log.error("Error getting boundaries for zone cleaning map %s of robot %s: %s", map.id, robot.name, error)
													}
													else
													{
														map.boundaries = result.boundaries;
													}
													loadedMaps++;

													// Robot is completely requested if zones for all maps are loaded
													if (loadedMaps === robot.maps.length)
													{
														this.robots.push({device: robot, meta: state.meta, availableServices: state.availableServices});
														this.checkDone(loadedRobots, robots.length, callback);
													}
												})
											});
										}
									});
								}
							});
						});
					}
				});
			}
		});
	},

	checkDone: function (loadedRobots, allrobots, callback)
	{
		loadedRobots++;
		if (loadedRobots === allrobots)
		{
			debug("Async robot requests: DONE");
			callback();
		}
		else
		{
			debug("Async robot requests: PROCESSING (finished %s of %s)", loadedRobots, allrobots);
		}
	},

	updateRobot: function (serial, callback)
	{
		let robot = this.getRobot(serial);

		// Data is up to date
		if (typeof (robot.lastUpdate) !== 'undefined' && new Date() - robot.lastUpdate < 2000)
		{
			callback();
		}
		else
		{
			debug(robot.device.name + ": ++ Updating robot state");
			robot.lastUpdate = new Date();
			robot.device.getState((error, result) =>
			{
				if (error)
				{
					this.log.error("Cannot update robot. Check if robot is online. " + error);
				}
				callback();
			});
		}
	},

	getRobot(serial)
	{
		let result;
		this.robots.forEach(function (robot)
		{
			if (robot.device._serial === serial)
			{
				result = robot;
			}
		});
		return result;
	},

	updateRobotTimer: function (serial)
	{
		this.updateRobot(serial, () =>
		{
			let robot = this.getRobot(serial);
			// Clear any other overlapping timers for this robot
			clearTimeout(robot.timer);

			// Tell all accessories of this robot (mainAccessory and roomAccessories) that updated robot data is available
			robot.mainAccessory.updated();
			robot.roomAccessories.forEach(accessory =>
			{
				accessory.updated();
			});

			// Periodic refresh interval set in config
			if (this.refresh !== 'auto' && this.refresh !== 0)
			{
				debug(robot.device.name + ": ++ Next background update in " + this.refresh + " seconds");
				robot.timer = setTimeout(this.updateRobotTimer.bind(this), this.refresh * 1000, serial);
			}
			// Auto refresh set in config
			else if (this.refresh === 'auto' && robot.device.canPause)
			{
				debug(robot.device.name + ": ++ Next background update in 60 seconds while cleaning (auto mode)");
				robot.timer = setTimeout(this.updateRobotTimer.bind(this), 60 * 1000, serial);
			}
			// No refresh
			else
			{
				debug(robot.device.name + ": ++ Stopped background updates");
			}
		});
	},
};