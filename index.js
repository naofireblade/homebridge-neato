"use strict";
let inherits = require('util').inherits,
	debug = require('debug')('homebridge-neato'),
	botvac = require('node-botvac'),

	Service,
	Characteristic;

module.exports = function (homebridge)
{
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerPlatform("homebridge-neato", "NeatoVacuumRobot", NeatoVacuumRobotPlatform);
};

function NeatoVacuumRobotPlatform(log, config)
{
	this.log = log;
	this.serial = "1-3-3-7";
	this.email = config['email'];
	this.password = config['password'];
	this.hiddenServices = ('disabled' in config ? config['disabled'] : '');

	// Array of real robots and associated robot accessories (incl rooms)
	this.robots = [];

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
		debug("##############################################");
		debug("################# GET ROBOTS #################");
		debug("##############################################");
		let accessories = [];
		this.boundaryNames = [];
		this.getRobots(() =>
		{
			this.robots.forEach((robot, i) =>
			{
				this.log("Found robot #" + (i + 1) + " named \"" + robot.device.name + "\" with serial \"" + robot.device._serial + "\"");
				this.updateRobotTimer(robot.device._serial);

				let NeatoVacuumRobotAccessory = require('./accessories/neatoVacuumRobot')(Service, Characteristic);
				let mainAccessory = new NeatoVacuumRobotAccessory(robot, this);
				accessories.push(mainAccessory);

				robot.mainAccessory = mainAccessory;
				robot.roomAccessories = [];

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
									let roomAccessory = new NeatoVacuumRobotAccessory(robot, this, boundary);
									accessories.push(roomAccessory);

									robot.roomAccessories.push(roomAccessory);
								}
							})
						}
					})
				}
			});
			callback(accessories);
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
				// Get robots
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
						let requestedRobot = 0;

						robots.forEach((robot) =>
						{
							// Get Maps for each robot
							robot.getPersistentMaps((error, result) =>
							{
								if (error)
								{
									this.log.error("Error updating persistent maps: " + error + ": " + result);
									callback();
								}
								else if (result.length === 0)
								{
									robot.maps = [];
									callback();
								}
								else
								{
									robot.maps = result;
									let requestedMap = 0;
									robot.maps.forEach((map) =>
									{
										// Get Map Boundary Lines
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
											requestedMap++;

											// Robot is completely requested if all maps are requested
											if (requestedMap === robot.maps.length)
											{
												this.robots.push({device: robot});
												requestedRobot++;

												// Initial request is complete if all robots are requested.
												if (requestedRobot === robots.length)
												{
													callback();
												}
											}
										})
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
			robot.device.getState(function (error, result)
			{
				if (error)
				{
					this.log.error("Cannot update robot. Check if robot is online. " + error);
				}
				robot.lastUpdate = new Date();
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