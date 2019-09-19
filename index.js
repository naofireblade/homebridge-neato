"use strict";
var inherits = require('util').inherits,
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

	if ('refresh' in config && config['refresh'] !== 'auto')
	{
		// parse config parameter
		this.refresh = parseInt(config['refresh']);
		// must be integer and positive
		this.refresh = (typeof this.refresh !== 'number' || (this.refresh % 1) !== 0 || this.refresh < 0) ? 60 : this.refresh;
		// minimum 60s to save some load on the neato servers
		this.refresh = (this.refresh > 0 && this.refresh < 60) ? 60 : this.refresh;
	}
	// default auto
	else
	{
		this.refresh = 'auto';
	}
	debug("Refresh is set to: " + this.refresh);
}

NeatoVacuumRobotPlatform.prototype = {
	accessories: function (callback)
	{
		let accessories = [];
		let platform = this;
		platform.boundaryNames = [];
		this.getRobots(function ()
		{
			if (platform.robots)
			{
				platform.robots.forEach((robot, i) =>
				{
					platform.log("Found robot #" + (i + 1) + " named \"" + robot.name + "\" with serial \"" + robot._serial + "\"");

					let NeatoVacuumRobotAccessory = require('./accessories/neatVacuumRobot')(Service, Characteristic);
					let robotAccessory = new NeatoVacuumRobotAccessory(robot, platform);
					accessories.push(robotAccessory);

					if (robot.maps)
					{
						robot.maps.forEach((map) =>
						{
							if (map.boundaries)
							{
								map.boundaries.forEach((boundary) =>
								{
									if (boundary.type === "polygon")
									{
										accessories.push(new NeatoVacuumRobotAccessory(robot, platform, boundary))
									}
								})
							}
						})
					}
				})
			}
			callback(accessories);
		});
	},

	getRobots: function (callback)
	{
		debug("Loading your robots");
		let client = new botvac.Client();
		let that = this;
		client.authorize(this.email, this.password, false, (error) =>
		{
			if (error)
			{
				that.log(error);
				that.log.error("Can't log on to neato cloud. Please check your internet connection and your credentials. Try again later if the neato servers have issues.");
				callback();
			}
			else
			{
				client.getRobots((error, robots) =>
				{
					if (error)
					{
						that.log(error);
						that.log.error("Successful login but can't connect to your neato robot.");
						callback();
					}
					else
					{
						if (robots.length === 0)
						{
							that.log.error("Successful login but no robots associated with your account.");
							that.robots = [];
							callback();
						}
						else
						{
							debug("Found " + robots.length + " robots");
							let updatedRobotCount = 0;
							that.robots = robots;
							that.robots.forEach((robot) =>
							{
								robot.getPersistentMaps((error, result) =>
								{
									if (error)
									{
										that.log("Error updating persistent maps: " + error + ": " + result);
										callback();
										return;
									}
									robot.maps = result;
									let processedMapCount = 0;
									if (robot.maps.length === 0)
									{
										callback();
									}
									robot.maps.forEach((map) =>
									{
										robot.getMapBoundaries(map.id, (error, result) =>
										{
											if (error)
											{
												this.log("error getting boundaries: " + error + ": " + result)
											}
											else
											{
												map.boundaries = result.boundaries;
											}
											processedMapCount++;
											if (processedMapCount == robot.maps.length)
											{
												updatedRobotCount++;
												if (updatedRobotCount === that.robots.length)
												{
													callback();
												}
											}
										})
									})
								})
							})
						}
					}
				});
			}
		});
	}
};