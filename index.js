"use strict";
var inherits = require('util').inherits;
var debug = require('debug')('homebridge-neato');
var botvac = require('node-botvac');

var Service, Characteristic;

module.exports = function (homebridge) {
	Service = homebridge.hap.Service;
	Characteristic = homebridge.hap.Characteristic;
	homebridge.registerAccessory("homebridge-neato", "NeatoVacuumRobot", NeatoVacuumRobot);
}

function NeatoVacuumRobot(log, config) {
	this.log = log;
	this.name = config['name'];
	this.serial = "1-3-3-7";
	this.email = config['email'];
	this.password = config['password'];

	this.lastUpdate = null;
	this.robot = null;
}

NeatoVacuumRobot.prototype = {
	identify: function (callback) {
		this.log("Identify requested");
		callback();
	},

	getServices: function () {
		this.informationService = new Service.AccessoryInformation();
		this.informationService
		.setCharacteristic(Characteristic.Manufacturer, "Neato Robotics")
		.setCharacteristic(Characteristic.Model, this.name)
		.setCharacteristic(Characteristic.SerialNumber, this.serial);

		this.vacuumRobotCleanService = new Service.Switch(this.name + " Clean", "clean");
		this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('set', this.clean.bind(this));
		this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('get', this.getClean.bind(this));

		this.vacuumRobotGoToDockService = new Service.Switch(this.name + " Go to Dock", "goToDock");
		this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('set', this.dock.bind(this));
		this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('get', this.getCanGoToDock.bind(this));

		this.vacuumRobotDockStateService = new Service.OccupancySensor(this.name + " Dock", "dockState");
		this.vacuumRobotDockStateService.getCharacteristic(Characteristic.OccupancyDetected).on('get', this.getDockState.bind(this));

		this.vacuumRobotEcoService = new Service.Switch(this.name + " Eco Mode", "eco");
		this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('set', this.eco.bind(this));
		this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('get', this.getEco.bind(this));

		this.vacuumRobotScheduleService = new Service.Switch(this.name + " Schedule", "schedule");
		this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('set', this.schedule.bind(this));
		this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('get', this.getSchedule.bind(this));

		this.vacuumRobotBatteryService = new Service.BatteryService("Battery", "battery");
		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.ChargingState).on('get', this.getBatteryChargingState.bind(this));

		return [this.informationService, this.vacuumRobotCleanService, this.vacuumRobotGoToDockService, this.vacuumRobotDockStateService, this.vacuumRobotEcoService,
			this.vacuumRobotScheduleService, this.vacuumRobotBatteryService];
	},

	clean: function (on, callback) {
		let that = this;
		if (on) {
			this.getState(function (error, result) {
				if (that.robot.canResume === true) {
					debug("Resume cleaning");
					that.robot.resumeCleaning(function (error, result) {
						that.log(result);
					});
				}
				else {
					debug("Start cleaning");
					that.robot.startCleaning(that.robot.eco, function (error, result) {
						that.log(result);
					});
				}
			});
		}
		else {
			debug("Pause cleaning");
			this.robot.pauseCleaning(false, function (error, result) {
				that.log(result);
			});
		}
		callback();
	},

	dock: function (on, callback) {
		let that = this;
		if (on) {
			debug("Go to dock");
			that.robot.sendToBase(false, function (error, result) {
				that.log(result);
			});
		}
		callback();
	},

	eco: function (on, callback) {
		debug(on ? "Enable eco mode" : "Disable eco mode");
		this.robot.eco = on;
		callback();
	},

	schedule: function (on, callback) {
		let that = this;
		if (on) {
			debug("Enable schedule");
			this.robot.enableSchedule(false, function (error, result) {
				that.log(result);
			}); 
		}
		else {
			debug("Disable schedule");
			this.robot.disableSchedule(false, function (error, result) {
				that.log(result);
			}); 
		}
		callback();
	},

	getClean: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			debug("Is cleaning: " + that.robot.canPause);
			callback(false, that.robot.canPause);
		});
	},

	getCanGoToDock: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			debug("Can go to dock: " + that.robot.canGoToBase);
			callback(false, !that.robot.canGoToBase);
		});
	},

	getDockState: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			debug("Is docked: " + that.robot.isDocked);
			callback(false, that.robot.isDocked);
		});
	},

	getEco: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			debug("Eco mode: " + that.robot.eco);
			callback(false, that.robot.eco);
		});
	},

	getSchedule: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			debug("Schedule: " + that.robot.isScheduleEnabled);
			callback(false, that.robot.isScheduleEnabled);
		});
	},


	getBatteryLevel: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			debug("Battery: " + that.robot.charge);
			callback(false, that.robot.charge);
		});
	},

	getBatteryChargingState: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			debug("Is charging: " + that.robot.isCharging);
			callback(false, that.robot.isCharging);
		});
	},

	getState: function(callback) {
		let that = this;
		if (this.robot === null)
		{
			this.getRobot(function (error, result) {
				that._getState(callback);
			});
		}
		else {
			that._getState(callback);
		}	
	},

	_getState: function(callback) {
		if (this.lastUpdate !== null && new Date() - this.lastUpdate < 2000) {
			debug("Get info (cached)");
			callback();
		}
		else {
			debug("Get info (new)");
			let that = this;
			this.robot.getState(function (error, result) {
				that.lastUpdate = new Date();
				callback();
			});
		}
	},

	getRobot: function(callback) {
		debug("Get robot");
		let client = new botvac.Client();
		let that = this;
		client.authorize(this.email, this.password, false, function (error) {
			if (error) {
				that.log(error);
			}
			else {
				client.getRobots(function (error, robots) {
					if (error) {
						that.log(error);
					}
					else {
						that.robot = robots[0];
						that.log("Found robot: " + that.robot.name);
						debug(that.robot);
						callback();
					}
				});
			}
		});
	}
}