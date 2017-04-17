"use strict";
var inherits = require('util').inherits;
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

		this.vacuumRobotDockService = new Service.Switch(this.name + " Dock", "dock");
		this.vacuumRobotDockService.getCharacteristic(Characteristic.On).on('set', this.dock.bind(this));
		this.vacuumRobotDockService.getCharacteristic(Characteristic.On).on('get', this.getDock.bind(this));

		this.vacuumRobotEcoService = new Service.Switch(this.name + " Eco Mode", "eco");
		this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('set', this.eco.bind(this));
		this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('get', this.getEco.bind(this));

		this.vacuumRobotScheduleService = new Service.Switch(this.name + " Schedule", "schedule");
		this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('set', this.schedule.bind(this));
		this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('get', this.getSchedule.bind(this));

		this.vacuumRobotBatteryService = new Service.BatteryService("Battery", "battery");
		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.ChargingState).on('get', this.getBatteryChargingState.bind(this));

		return [this.informationService, this.vacuumRobotCleanService, this.vacuumRobotDockService, this.vacuumRobotEcoService,
			this.vacuumRobotScheduleService, this.vacuumRobotBatteryService];
	},

	clean: function (on, callback) {
		let that = this;
		if (on) {
			this.getState(function (error, result) {
				that.log(that.robot);
				if (that.robot.canResume === true) {
					that.log("Resume cleaning");
					that.robot.resumeCleaning(function (error, result) {
						that.log(result);
					});
				}
				else {
					that.log("Start cleaning");
					that.robot.startCleaning(that.robot.eco, function (error, result) {
						that.log(result);
					});
				}
			});
		}
		else {
			this.log("Pause cleaning");
			this.robot.pauseCleaning(false, function (error, result) {
				that.log(result);
			});
		}
		callback();
	},

	dock: function (on, callback) {
		let that = this;
		that.log(that.robot);
		if (on) {
			that.log("Send to dock");
			that.robot.sendToBase(false, function (error, result) {
				that.log(result);
			});
		}
		callback();
	},

	eco: function (on, callback) {
		this.log(on ? "Enable eco mode" : "Disable eco mode");
		this.robot.eco = on;
		callback();
	},

	schedule: function (on, callback) {
		if (on) {
			this.log("Enable schedule");
			this.robot.enableSchedule(false, function (error, result) {
				onsole.log(result);
			}); 
		}
		else {
			this.log("Disable schedule");
			this.robot.disableSchedule(false, function (error, result) {
				onsole.log(result);
			}); 
		}
		callback();
	},

	getClean: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			that.log("Is cleaning: " + that.robot.canPause);
			callback(false, that.robot.canPause);
		});
	},

	getDock: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			that.log("Can go to dock: " + that.robot.canGoToBase);
			that.log("Is docked: " + that.robot.isDocked);
			callback(false, that.robot.isDocked);
		});
	},

	getEco: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			that.log("Eco mode: " + that.robot.eco);
			callback(false, that.robot.eco);
		});
	},

	getSchedule: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			that.log("Schedule: " + that.robot.isScheduleEnabled);
			callback(false, that.robot.isScheduleEnabled);
		});
	},


	getBatteryLevel: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			that.log("Battery: " + that.robot.charge);
			callback(false, that.robot.charge);
		});
	},

	getBatteryChargingState: function(callback) {
		let that = this;
		this.getState(function (error, result) {
			that.log("Is charging: " + that.robot.isCharging);
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
			//this.log("Get state (cached)");
			callback();
		}
		else {
			//this.log("Get state (new)");
			let that = this;
			this.robot.getState(function (error, result) {
				that.lastUpdate = new Date();
				callback();
			});
		}
	},

	getRobot: function(callback) {
		//this.log("Get robot");
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
						callback();
					}
				});
			}
		});
	}
}