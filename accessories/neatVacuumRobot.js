const debug = require('debug')('homebridge-neato');

let Service,
	Characteristic;

module.exports = function (_Service, _Characteristic)
{
	Service = _Service;
	Characteristic = _Characteristic;

	return NeatoVacuumRobotAccessory;
};

function NeatoVacuumRobotAccessory(robot, platform, boundary = undefined)
{
	this.platform = platform;
	this.boundary = boundary;
	this.log = platform.log;
	this.refresh = platform.refresh;
	this.hiddenServices = platform.hiddenServices;
	this.robot = robot;
	this.nextRoom = null;

	if (typeof boundary === 'undefined')
	{
		this.name = robot.name;
	}
	else
	{
		// if boundary name already exists
		if (platform.boundaryNames.includes(this.boundary.name))
		{
			let lastChar = this.boundary.name.slice(-1);
			// boundary name already contains a count number
			if (!isNaN(lastChar))
			{
				// Increment existing count number
				this.boundary.name = this.boundary.name.slice(0, -1) + (parseInt(lastChar) + 1);
			}
			else
			{
				// Add a new count number
				this.boundary.name = this.boundary.name + " 2";
			}
		}
		platform.boundaryNames.push(this.boundary.name);
		this.name = this.robot.name + ' - ' + this.boundary.name;
	}
	this.lastUpdate = null;

	this.vacuumRobotBatteryService = new Service.BatteryService("Battery", "battery");

	if (typeof boundary === 'undefined')
	{
		this.vacuumRobotCleanService = new Service.Switch("Clean", "clean");
		this.vacuumRobotGoToDockService = new Service.Switch(this.name + " Go to Dock", "goToDock");
		this.vacuumRobotDockStateService = new Service.OccupancySensor(this.name + " Dock", "dockState");
		this.vacuumRobotEcoService = new Service.Switch(this.name + " Eco Mode", "eco");
		this.vacuumRobotNoGoLinesService = new Service.Switch(this.name + " NoGo Lines", "noGoLines");
		this.vacuumRobotExtraCareService = new Service.Switch(this.name + " Extra Care", "extraCare");
		this.vacuumRobotScheduleService = new Service.Switch(this.name + " Schedule", "schedule");
	}
	else
	{
		const splitName = boundary.name.split(' ');
		let serviceName = "Clean the " + boundary.name;
		if (splitName.length >= 2 && splitName[splitName.length - 2].match(/[']s$/g))
		{
			serviceName = "Clean " + boundary.name;
		}
		this.vacuumRobotCleanBoundaryService =
			new Service.Switch(serviceName, "cleanBoundary:" + boundary.id);
		this.log("Adding zone cleaning for: " + boundary.name);
	}

	this.updateRobotTimer();
}

NeatoVacuumRobotAccessory.prototype = {
	identify: function (callback)
	{
		let that = this;
		this.updateRobot(function ()
		{
			// hide serial and secret in log
			let _serial = that.robot._serial;
			let _secret = that.robot._secret;
			that.robot._serial = "*****";
			that.robot._secret = "*****";
			that.log(that.robot);
			that.robot._serial = _serial;
			that.robot._secret = _secret;
		});
	},

	getServices: function ()
	{
		this.informationService = new Service.AccessoryInformation();
		this.informationService
		.setCharacteristic(Characteristic.Manufacturer, "Neato Robotics")
		.setCharacteristic(Characteristic.Model, "Coming soon")
		.setCharacteristic(Characteristic.SerialNumber, this.robot._serial);
		if (!this.boundary)
		{
			this.informationService
			.setCharacteristic(Characteristic.Name, this.robot.name)
		}
		else
		{
			this.informationService
			.setCharacteristic(Characteristic.Name, this.robot.name + ' - ' + this.boundary.name)
		}

		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
		this.vacuumRobotBatteryService.getCharacteristic(Characteristic.ChargingState).on('get', this.getBatteryChargingState.bind(this));

		this.services = [this.informationService, this.vacuumRobotBatteryService];

		if (!this.boundary)
		{
			this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('set', this.setClean.bind(this));
			this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).on('get', this.getClean.bind(this));

			this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('set', this.setGoToDock.bind(this));
			this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).on('get', this.getGoToDock.bind(this));

			this.vacuumRobotDockStateService.getCharacteristic(Characteristic.OccupancyDetected).on('get', this.getDock.bind(this));

			this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('set', this.setEco.bind(this));
			this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).on('get', this.getEco.bind(this));

			this.vacuumRobotNoGoLinesService.getCharacteristic(Characteristic.On).on('set', this.setNoGoLines.bind(this));
			this.vacuumRobotNoGoLinesService.getCharacteristic(Characteristic.On).on('get', this.getNoGoLines.bind(this));

			this.vacuumRobotExtraCareService.getCharacteristic(Characteristic.On).on('set', this.setExtraCare.bind(this));
			this.vacuumRobotExtraCareService.getCharacteristic(Characteristic.On).on('get', this.getExtraCare.bind(this));

			this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('set', this.setSchedule.bind(this));
			this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).on('get', this.getSchedule.bind(this));

			this.services.push(this.vacuumRobotCleanService);

			if (this.hiddenServices.indexOf('dock') === -1)
				this.services.push(this.vacuumRobotGoToDockService);
			if (this.hiddenServices.indexOf('dockstate') === -1)
				this.services.push(this.vacuumRobotDockStateService);
			if (this.hiddenServices.indexOf('eco') === -1)
				this.services.push(this.vacuumRobotEcoService);
			if (this.hiddenServices.indexOf('nogolines') === -1)
				this.services.push(this.vacuumRobotNoGoLinesService);
			if (this.hiddenServices.indexOf('extracare') === -1)
				this.services.push(this.vacuumRobotExtraCareService);
			if (this.hiddenServices.indexOf('schedule') === -1)
				this.services.push(this.vacuumRobotScheduleService);
		}

		if (this.boundary)
		{
			this.vacuumRobotCleanBoundaryService.getCharacteristic(Characteristic.On).on('set', (on, serviceCallback) =>
			{
				this.setClean(on, serviceCallback, this.boundary)
			});
			this.vacuumRobotCleanBoundaryService.getCharacteristic(Characteristic.On).on('get', (serviceCallback) =>
			{
				this.getClean(serviceCallback, this.boundary);
			});
			this.services.push(this.vacuumRobotCleanBoundaryService);
		}

		return this.services;
	},


	getClean: function (callback, boundary)
	{
		this.updateRobot((error, result) =>
		{
			let cleaning;
			if (typeof boundary === 'undefined')
			{
				cleaning = this.robot.canPause;
			}
			else
			{
				cleaning = this.robot.canPause && (this.robot.cleaningBoundaryId === boundary.id)
			}

			debug(this.name + ": Is cleaning: " + cleaning);
			callback(false, cleaning);
		});
	},

	setClean: function (on, callback, boundary)
	{
		this.updateRobot((error, result) =>
		{
			// Start
			if (on)
			{
				// No room given or same room
				if (typeof boundary === 'undefined' || this.robot.cleaningBoundaryId === boundary.id)
				{
					// Resume cleaning
					if (this.robot.canResume)
					{
						debug(this.name + ": Resume cleaning");
						this.robot.resumeCleaning(callback);
					}
					// Start cleaning
					else if (this.robot.canStart)
					{
						this.clean(callback, boundary);
					}
					// Cannot start
					else
					{
						debug(this.name + ": Cannot start, maybe already cleaning");
						callback();
					}
				}
				// Different room given
				else
				{
					// Return to dock
					if (this.robot.canPause || this.robot.canResume)
					{
						debug(this.name + ": Returning to dock to start cleaning of new room");
						this.setGoToDock(true, (error, result) => {
							this.nextRoom = boundary;

							setTimeout(() =>
							{
								this.clean(callback, boundary);
							}, 1000);
						});
					}
					// Start new cleaning of new room
					else
					{
						this.clean(callback, boundary);
					}
				}
			}
			// Stop
			else
			{
				if (this.robot.canPause)
				{
					debug(this.name + ": Pause cleaning");
					this.robot.pauseCleaning(callback);
				}
				else
				{
					debug(this.name + ": Already paused");
					callback();
				}
			}
		});
	},

	clean: function (callback, boundary)
	{
		// Start automatic update while cleaning
		if (this.refresh === 'auto')
		{
			setTimeout(() =>
			{
				clearTimeout(this.timer);
				this.updateRobotTimer();
			}, 60 * 1000);
		}


		let eco = this.vacuumRobotEcoService.getCharacteristic(Characteristic.On).value;
		let extraCare = this.vacuumRobotExtraCareService.getCharacteristic(Characteristic.On).value;
		let nogoLines = this.vacuumRobotNoGoLinesService.getCharacteristic(Characteristic.On).value;
		let room = typeof boundary === 'undefined' ? '' : boundary.name;
		debug(that.name + ": Start cleaning (" + room + " eco: " + eco + ", extraCare: " + extraCare + ", nogoLines: " + nogoLines + ")");

		// Normal cleaning
		if (typeof boundary === 'undefined')
		{
			this.robot.startCleaning(
				eco,
				extraCare ? 2 : 1,
				nogoLines,
				(error, result) =>
				{
					if (error)
					{
						this.log.error("Cannot start cleaning. " + error + ": " + JSON.stringify(result));
						callback(true);
					}
					else
					{
						callback();
					}
				});
		}
		// Room cleaning
		else
		{
			this.robot.startCleaningBoundary(eco, extraCare, boundary.id, (error, result) =>
			{
				if (error)
				{
					this.log.error("Cannot start room cleaning. " + error + ": " + JSON.stringify(result));
					callback(true);
				}
				else
				{
					callback();
				}
			});
		}
	},

	getGoToDock: function (callback)
	{
		callback(false, false);
	},

	setGoToDock: function (on, callback)
	{
		let that = this;
		this.updateRobot(function (error, result)
		{
			if (on)
			{
				if (that.robot.canPause)
				{
					debug(that.name + ": Pause cleaning to go to dock");
					that.robot.pauseCleaning(function (error, result)
					{
						setTimeout(function ()
						{
							debug(that.name + ": Go to dock");
							that.robot.sendToBase(callback);
						}, 1000);
					});
				}
				else if (that.robot.canGoToBase)
				{
					debug(that.name + ": Go to dock");
					that.robot.sendToBase(callback);
				}
				else
				{
					that.log.warn(that.name + ": Can't go to dock at the moment");
					callback();
				}
			}
			else
			{
				callback();
			}
		});
	},

	getEco: function (callback)
	{
		let that = this;
		this.updateRobot(function ()
		{
			debug(that.name + ": Eco mode is " + (that.robot.eco ? 'ON' : 'OFF'));
			callback(false, that.robot.eco);
		});
	},

	setEco: function (on, callback)
	{
		this.robot.eco = on;
		debug(this.name + ": " + (on ? "Enabled" : "Disabled") + " Eco mode ");
		callback();
	},

	getNoGoLines: function (callback)
	{
		let that = this;
		this.updateRobot(function ()
		{
			debug(that.name + ": Nogo Lines are " + (that.robot.eco ? 'ON' : 'OFF'));
			callback(false, that.robot.noGoLines ? 1 : 0);
		});
	},

	setNoGoLines: function (on, callback)
	{
		this.robot.noGoLines = on;
		debug(this.name + ": " + (on ? "Enabled" : "Disabled") + " Nogo lines ");
		callback();
	},

	getExtraCare: function (callback)
	{
		let that = this;
		this.updateRobot(function ()
		{
			debug(that.name + ": Extra Care Navigation is " + (that.robot.navigationMode == 2 ? 'ON' : 'OFF'));
			callback(false, that.robot.navigationMode == 2 ? 1 : 0);
		});
	},

	setExtraCare: function (on, callback)
	{
		this.robot.navigationMode = on ? 2 : 1;
		debug(this.name + ": " + (on ? "Enabled" : "Disabled") + " Extra Care Navigation ");
		callback();
	},

	getSchedule: function (callback)
	{
		let that = this;
		this.updateRobot(function ()
		{
			debug(that.name + ": Schedule is " + (that.robot.eco ? 'ON' : 'OFF'));
			callback(false, that.robot.isScheduleEnabled);
		});
	},

	setSchedule: function (on, callback)
	{
		let that = this;
		this.updateRobot(function (error, result)
		{
			if (on)
			{
				debug(that.name + ": Enabled Schedule");
				that.robot.enableSchedule(callback);
			}
			else
			{
				debug(that.name + ": Disabled Schedule");
				that.robot.disableSchedule(callback);
			}
		});
	},

	getDock: function (callback)
	{
		let that = this;
		this.updateRobot(function ()
		{
			debug(that.name + ": Is " + (that.robot.isDocked ? '' : 'not ') + "docked");
			callback(false, that.robot.isDocked ? 1 : 0);
		});
	},

	getBatteryLevel: function (callback)
	{
		let that = this;
		this.updateRobot(function ()
		{
			debug(that.name + ": Battery is at " + that.robot.charge + "%");
			callback(false, that.robot.charge);
		});
	},

	getBatteryChargingState: function (callback)
	{
		let that = this;
		this.updateRobot(function ()
		{
			debug(that.name + ": Is " + (that.robot.isCharging ? '' : 'not ') + "charging");
			callback(false, that.robot.isCharging);
		});
	},

	updateRobot: function (callback)
	{
		let that = this;
		if (this.lastUpdate !== null && new Date() - this.lastUpdate < 2000)
		{
			callback();
		}
		else
		{
			debug(this.name + ": Updating robot state");
			this.robot.getState(function (error, result)
			{
				if (error)
				{
					that.log.error("Cannot update robot. Check if robot is online. " + error);
				}
				that.lastUpdate = new Date();
				callback();
			});
		}
	},

	updateRobotTimer: function ()
	{
		this.updateRobot((error, result) =>
		{

			if (!this.boundary)
			{
				// only update these values if the state is different from the current one, otherwise we might accidentally start an action
				if (this.vacuumRobotCleanService.getCharacteristic(Characteristic.On).value !== this.robot.canPause)
				{
					this.vacuumRobotCleanService.setCharacteristic(Characteristic.On, this.robot.canPause);
				}

				// dock switch is on (dock not seen before) and dock has just been seen -> turn switch off
				if (this.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).value == true && this.robot.dockHasBeenSeen)
				{
					this.vacuumRobotGoToDockService.setCharacteristic(Characteristic.On, false);
				}

				if (this.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).value !== this.robot.isScheduleEnabled)
				{
					this.vacuumRobotScheduleService.setCharacteristic(Characteristic.On, this.robot.isScheduleEnabled);
				}

				// no commands here, values can be updated without problems
				this.vacuumRobotDockStateService.setCharacteristic(Characteristic.OccupancyDetected, this.robot.isDocked ? 1 : 0);
				this.vacuumRobotEcoService.setCharacteristic(Characteristic.On, this.robot.eco);
				this.vacuumRobotNoGoLinesService.setCharacteristic(Characteristic.On, this.robot.noGoLines);
				this.vacuumRobotExtraCareService.setCharacteristic(Characteristic.On, this.robot.navigationMode == 2 ? true : false);

			}
			else
			{
				if (this.vacuumRobotCleanBoundaryService.getCharacteristic(Characteristic.On).value !== this.robot.canPause)
				{
					this.vacuumRobotCleanBoundaryService.setCharacteristic(Characteristic.On, this.robot.canPause);
				}
			}

			this.vacuumRobotBatteryService.setCharacteristic(Characteristic.BatteryLevel, this.robot.charge);
			this.vacuumRobotBatteryService.setCharacteristic(Characteristic.ChargingState, this.robot.isCharging);

			// Robot has a next room to clean in queue
			if (this.nextRoom !== null && this.robot.isDocked)
			{
				this.clean((error, result) => {
					this.nextRoom = null;
				}, this.nextRoom);
			}

			// robot is currently cleaning, refresh is set to auto or specific interval -> continue updating
			if (this.robot.canPause && this.refresh !== 0)
			{
				let refreshTime = this.refresh === 'auto' ? 60 : this.refresh;
				debug(this.name + ": Updating state in background every " + refreshTime + " seconds while cleaning");
				this.timer = setTimeout(this.updateRobotTimer.bind(this), refreshTime * 1000);
			}
			// robot is not cleaning, but a specific refresh interval is set -> continue updating
			else if (this.refresh !== 'auto' && this.refresh !== 0)
			{
				debug(this.name + ": Updating state in background every " + this.refresh + " seconds (user setting)");
				this.timer = setTimeout(this.updateRobotTimer.bind(this), this.refresh * 1000);
			}
			// robot is not cleaning, no specific refresh interval is set -> stop updating
			else
			{
				debug(this.name + ": Disabled background updates");
			}
		});
	},
};