"use strict";
var inherits = require('util').inherits,
	debug = require('debug')('homebridge-neato'),
	botvac = require('node-botvac'),

	Service,
	Characteristic

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerPlatform("homebridge-neato", "NeatoVacuumRobot", NeatoVacuumRobotPlatform);
}

function NeatoVacuumRobotPlatform(log, config) {
	this.log = log;
	this.serial = "1-3-3-7";
	this.email = config['email'];
	this.password = config['password'];
	this.hiddenServices = config['disabled'];

	this.careNavigation = ('extraCareNavigation' in config && config['extraCareNavigation'] ? 2 : 1);
	debug("Extra Care Navigation: " + this.careNavigation);

	// default off
	this.refresh = ('refresh' in config ? parseInt(config['refresh']) : 0);
	// must be integer and positive
	this.refresh = (typeof this.refresh !=='number' || (this.refresh%1)!==0 || this.refresh < 0) ? 0 : this.refresh;
	// minimum 60s
	this.refresh = (this.refresh > 0 && this.refresh < 60) ? 60 : this.refresh;
}

NeatoVacuumRobotPlatform.prototype = {
	accessories: function(callback) {
		this.accessories = [];

		let that = this;
		this.robots = this.getRobots(function () {
			for (var i = 0; i < that.robots.length; i++) {
				that.log("Found robot #" + (i+1) + ": " + that.robots[i].name);
				var robotAccessory = new NeatoVacuumRobotAccessory(that.robots[i], that);
				that.accessories.push(robotAccessory);
			}
			callback(that.accessories);
		});
	},

	getRobots: function(callback) {
		debug("Get all robots");
		let client = new botvac.Client();
		let that = this;
		client.authorize(this.email, this.password, false, function (error) {
			if (error) {
				that.log(error);
				that.log.error("Can't log on to neato cloud. Please check your credentials.");
				callback();
			}
			else {
				client.getRobots(function (error, robots) {
					if (error) {
						that.log(error);
						that.log.error("Successful login but can't connect to your neato robot.");
						callback();
					}
					else {
						if (robots.length === 0) {
							that.log.error("Successful login but no robots associated with your account.");
							callback();					
						}
						else {
							that.robots = robots;
							callback();
						}
					}
				});
			}
		});
	}
}

function NeatoVacuumRobotAccessory(robot, platform) {
	this.platform = platform;
	this.log = platform.log;
	this.refresh = platform.refresh;
	this.careNavigation = platform.careNavigation;
	this.hiddenServices = platform.hiddenServices;
	this.robot = robot;
	this.name = robot.name;
	this.lastUpdate = null;

	this.vacuumRobotCleanService = new Service.Switch(this.name + " Clean", "clean");
	this.vacuumRobotGoToDockService = new Service.Switch(this.name + " Go to Dock", "goToDock");
	this.vacuumRobotDockStateService = new Service.OccupancySensor(this.name + " Dock", "dockState");
	this.vacuumRobotEcoService = new Service.Switch(this.name + " Eco Mode", "eco");
	this.vacuumRobotScheduleService = new Service.Switch(this.name + " Schedule", "schedule");
	this.vacuumRobotBatteryService = new Service.BatteryService("Battery", "battery");

	this.updateRobotTimer();	
}


NeatoVacuumRobotAccessory.prototype = {
	identify: function (callback) {
		let that = this;
		this.updateRobot(function() {
			// hide serial and secret in log
			let _serial = that.robot._serial;
			let _secret = that.robot._secret;
			that.robot._serial = "*****";
			that.robot._secret = "*****";
			that.log(that.robot);
			that.robot._serial = _serial;
			that.robot._secret = _secret;
			callback();
		});
	},

	getServices: function () {
		debug(this.robot._serial);
		this.informationService = new Service.AccessoryInformation();
		this.informationService
		.setCharacteristic(Characteristic.Name, this.robot.name)
		.setCharacteristic(Characteristic.Manufacturer, "Neato Robotics")
		.setCharacteristic(Characteristic.Model, "Coming soon")
		.setCharacteristic(Characteristic.SerialNumber, this.robot._serial);

		this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('set', this.setClean.bind(this));
		this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('get', this.getClean.bind(this));

		this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('set', this.setGoToDock.bind(this));
		this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('get', this.getGoToDock.bind(this));

		this.vacuumRobotDockStateService.getCharacteristic(Characteristic.OccupancyDetected).on('get', this.getDock.bind(this));

		this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('set', this.setEco.bind(this));
		this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('get', this.getEco.bind(this));

		this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('set', this.setSchedule.bind(this));
		this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('get', this.getSchedule.bind(this));

		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.ChargingState).on('get', this.getBatteryChargingState.bind(this));

		this.services = [this.informationService, this.vacuumRobotCleanService, this.vacuumRobotBatteryService];
		if (this.hiddenServices.indexOf('dock') === -1)
			this.services.push(this.vacuumRobotGoToDockService);
		if (this.hiddenServices.indexOf('dockstate') === -1)
			this.services.push(this.vacuumRobotDockStateService);
		if (this.hiddenServices.indexOf('eco') === -1)
			this.services.push(this.vacuumRobotEcoService);
		if (this.hiddenServices.indexOf('schedule') === -1)
			this.services.push(this.vacuumRobotScheduleService);

		return this.services;
	},

	setClean: function (on, callback) {
		let that = this;
		this.updateRobot(function (error, result) {
			if (on) {
				if (that.robot.canResume || that.robot.canStart) {
					// wait for robot to start and then start a short timer to recognize when he can go to dock or is finished
					setTimeout(function() {
						clearTimeout(that.timer);
						that.updateRobotTimer();
					}, 10000);

					if (that.robot.canResume) {
						debug(that.name + ": Resume cleaning");
						that.robot.resumeCleaning(callback);
					}
					else {
						debug(that.name + ": Start cleaning (" + that.careNavigation + ")");
						that.robot.startCleaning(that.robot.eco, that.careNavigation, callback);
					}
				}
				else {
					debug(that.name + ": Cant start, maybe already cleaning");
					callback();
				}
			}
			else {
				if (that.robot.canPause) {
					debug(that.name + ": Pause cleaning");
					that.robot.pauseCleaning(callback);
				}
				else {
					debug(that.name + ": Already stopped");
					callback();
				}
			}
		});
	},

	setGoToDock: function (on, callback) {
		let that = this;
		this.updateRobot(function (error, result) {
			if (on) {
				if (that.robot.canPause) {
					debug(that.name + ": Pause cleaning to go to dock");
					that.robot.pauseCleaning(function (error, result) {
						setTimeout(function() {
							debug("Go to dock");
						    that.robot.sendToBase(callback);
						}, 1000);
					});
				}
				else if (that.robot.canGoToBase)
				{
					debug(that.name + ": Go to dock");
					that.robot.sendToBase(callback);
				}
				else {
					debug(that.name + ": Can't go to dock at the moment");
					callback();
				}
			} else {
				callback();
			}
		});
	},

	setEco: function (on, callback) {
		debug(this.name + ": " + (on ? "Enable eco mode" : "Disable eco mode"));
		this.robot.eco = on;
		callback();
	},

	setSchedule: function (on, callback) {
		let that = this;
		this.updateRobot(function (error, result) {
			if (on) {
				debug(that.name + ": Enable schedule");
				that.robot.enableSchedule(callback); 
			}
			else {
				debug(that.name + ": Disable schedule");
				that.robot.disableSchedule(callback); 
			}
		});
	},

	getClean: function(callback) {
		let that = this;
		this.updateRobot(function (error, result) {
			debug(that.name + ": Is cleaning: " + that.robot.canPause);
			callback(false, that.robot.canPause);
		});
	},

	getGoToDock: function(callback) {
		let that = this;
		this.updateRobot(function (error, result) {
			debug(that.name + ": Can go to dock: " + that.robot.dockHasBeenSeen);
			callback(false, !that.robot.dockHasBeenSeen);
		});
	},

	getDock: function(callback) {
		let that = this;
		this.updateRobot(function (error, result) {
			debug(that.name + ": Is docked: " + that.robot.isDocked);
			callback(false, that.robot.isDocked);
		});
	},

	getEco: function(callback) {
		// dont load eco here, because we cant save the eco state on the robot
		callback(false, this.robot.eco);
	},

	getSchedule: function(callback) {
		let that = this;
		this.updateRobot(function (error, result) {
			debug(that.name + ": Schedule: " + that.robot.isScheduleEnabled);
			callback(false, that.robot.isScheduleEnabled);
		});
	},


	getBatteryLevel: function(callback) {
		let that = this;
		this.updateRobot(function (error, result) {
			debug(that.name + ": Battery: " + that.robot.charge);
			callback(false, that.robot.charge);
		});
	},

	getBatteryChargingState: function(callback) {
		let that = this;
		this.updateRobot(function (error, result) {
			debug(that.name + ": Is charging: " + that.robot.isCharging);
			callback(false, that.robot.isCharging);
		});
	},

	updateRobot: function(callback) {
		let that = this;
		if (this.lastUpdate !== null && new Date() - this.lastUpdate < 2000) {
			debug(this.name + ": Update (cached)");
			callback();
		}
		else {
			debug(this.name + ": Update (online)");
			this.robot.getState(function (error, result) {
				that.lastUpdate = new Date();
				callback();
			});
		}
	},

	updateRobotTimer: function() {
		let that = this;
		debug(this.name + ": Timer called");
		this.updateRobot(function (error, result) {

			// only update these values if the state is different from the current one, otherwise we might accidentally start an action
			if (that.vacuumRobotCleanService.getCharacteristic(Characteristic.On).value !== that.robot.canPause) {
				that.vacuumRobotCleanService.setCharacteristic(Characteristic.On, that.robot.canPause);
			}

			if (that.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).value !== !that.robot.dockHasBeenSeen) {
				that.vacuumRobotGoToDockService.setCharacteristic(Characteristic.On, !that.robot.dockHasBeenSeen);
			}

			if (that.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).value !== that.robot.isScheduleEnabled) {
				that.vacuumRobotScheduleService.setCharacteristic(Characteristic.On, that.robot.isScheduleEnabled);
			}

			// no commands here, values can be updated without problems
			that.vacuumRobotDockStateService.setCharacteristic(Characteristic.OccupancyDetected, that.robot.isDocked);
			that.vacuumRobotBatteryService.setCharacteristic(Characteristic.BatteryLevel, that.robot.charge);
			that.vacuumRobotBatteryService.setCharacteristic(Characteristic.ChargingState, that.robot.isCharging);

			// dont update eco, because we cant write that value onto the robot and dont want it to be overwritten in our plugin

			if (that.robot.canPause) {
				debug(that.name + ": Timer set (cleaning): 30s");
				that.timer = setTimeout(that.updateRobotTimer.bind(that), 30 * 1000);			
			}
			else if (that.refresh != 0) {
				debug(that.name + ": Timer set (user): " + that.refresh + "s");
				that.timer = setTimeout(that.updateRobotTimer.bind(that), that.refresh * 1000);
			}
			else {
				debug(that.name + ": Timer stopped");
			}
		});
	},
}