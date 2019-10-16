"use strict";
let inherits = require('util').inherits,
	debug = require('debug')('homebridge-neato'),
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
	this.log("Refresh is set to: " + this.refresh + (this.refresh !== 'auto' ? ' seconds' : ''));
}

NeatoVacuumRobotPlatform.prototype = {
	accessories: function (callback)
	{
		debug("Get robots");
		let accessories = [];
		this.boundaryNames = [];

		this.getRobots(() =>
		{
			// // MOCK MULTIPLE ROBOTS START
			// let client = new botvac.Client();
			// client.authorize(this.email, this.password, false, (error) =>
			// {
			// 	client.getRobots((error, robs) =>
			// 	{
			// 		let testRobot = robs[0];
			// 		testRobot.getState((error, result) =>
			// 		{
			// 			testRobot.name = "Testrobot";
			// 			this.robots.push({device: testRobot, meta: result.meta, availableServices: result.availableServices});
			// 			// MOCK MULTIPLE ROBOTS END

						this.robots.forEach((robot, i) =>
						{
							this.log("Found robot #" + (i + 1) + " named \"" + robot.device.name + "\" with serial \"" + robot.device._serial.substring(0, 9) + "XXXXXXXXXXXX\"");

							let mainAccessory = new NeatoVacuumRobotAccessory(this, robot);
							accessories.push(mainAccessory);

							robot.mainAccessory = mainAccessory;
							robot.roomAccessories = [];

							// Start Update Intervall
							this.updateRobotTimer(robot.device._serial);

							// // MOCK ZONE CLEANING START
							// robot.boundary = {name: "Testroom", id: "1"};
							// let roomAccessory = new NeatoVacuumRobotAccessory(this, robot);
							// accessories.push(roomAccessory);
							// robot.roomAccessories.push(roomAccessory);
							// // MOCK ZONE CLEANING END

							if (robot.device.maps)
							{
								robot.device.maps.forEach((map) =>
								{
									if (map.boundaries)
									{
										map.boundaries.forEach((boundary) =>
										{
											if (boundary.type === "polygon")
											{
												robot.boundary = boundary;
												let roomAccessory = new NeatoVacuumRobotAccessory(this, robot);
												accessories.push(roomAccessory);

												robot.roomAccessories.push(roomAccessory);
											}
										})
									}
								})
							}
						});
						callback(accessories);

			// 			// MOCK MULTIPLE ROBOTS START
			// 		});
			// 	});
			// });
			// // MOCK MULTIPLE ROBOTS END
		});
	},

	getRobots: function (callback)
	{
		debug("Loading your robots");
		let client = new botvac.Client();

		// Login
		client.authorize(this.email, this.password, false, (error) =>
		{
			if (error)
			{
				this.log.error("Can't log on to neato cloud. Please check your internet connection and your credentials. Try again later if the neato servers have issues: " + error);
				callback();
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
						debug("Found " + robots.length + " robots");
						let loadedRobots = 0;

						robots.forEach((robot) =>
						{
							// Get additional information for the robot
							robot.getState((error, state) =>
							{
								if (error)
								{
									this.log.error("Error getting robot meta information: " + error + ": " + state);
									callback();
								}
								else
								{
									// Get all maps for each robot
									robot.getPersistentMaps((error, maps) =>
									{
										if (error)
										{
											this.log.error("Error updating persistent maps: " + error + ": " + maps);
											callback();
										}
										// Robot has no maps
										else if (maps.length === 0)
										{
											robot.maps = [];
											this.robots.push({device: robot, meta: state.meta, availableServices: state.availableServices});
											loadedRobots++;
											if (loadedRobots === robots.length)
											{
												callback();
											}
										}
										// Robot has maps
										else
										{
											robot.maps = maps;
											let loadedMaps = 0;
											robot.maps.forEach((map) =>
											{
												// Save zones in each map
												robot.getMapBoundaries(map.id, (error, result) =>
												{
													if (error)
													{
														this.log.error("Error getting boundaries: " + error + ": " + result)
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
														loadedRobots++;
														if (loadedRobots === robots.length)
														{
															callback();
														}
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