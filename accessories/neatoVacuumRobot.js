const debug = require('debug')('homebridge-neato');

const CustomUUID = {
	SpotCleanWidth: 'A7889A9A-2F27-4293-BEF8-3FE805B36F4E',
	SpotCleanHeight: 'CA282DB2-62BF-4325-A1BE-F8BB5478781A',
	SpotCleanRepeat: '1E79C603-63B8-4E6A-9CE1-D31D67981831'
};

let Service,
	Characteristic,
	SpotWidthCharacteristic,
	SpotHeightCharacteristic,
	SpotRepeatCharacteristic;

module.exports = function (_Service, _Characteristic)
{
	Service = _Service;
	Characteristic = _Characteristic;

	return NeatoVacuumRobotAccessory;
};

function NeatoVacuumRobotAccessory(platform, robotObject, boundary = undefined)
{
	this.platform = platform;
	this.log = platform.log;
	this.refresh = platform.refresh;
	this.hiddenServices = platform.hiddenServices;

	this.robotObject = robotObject;
	this.robot = robotObject.device;
	this.meta = robotObject.meta;
	this.availableServices = robotObject.availableServices;

	this.boundary = boundary;
	this.nextRoom = null;

	if (typeof boundary === 'undefined')
	{
		this.name = this.robot.name;
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

	this.batteryService = new Service.BatteryService("Battery", "battery");

	if (typeof boundary === 'undefined')
	{
		this.cleanService = new Service.Switch(this.name + " Clean", "clean");
		this.goToDockService = new Service.Switch(this.name + " Go to Dock", "goToDock");
		this.dockStateService = new Service.OccupancySensor(this.name + " Dock", "dockState");
		this.ecoService = new Service.Switch(this.name + " Eco Mode", "eco");
		this.noGoLinesService = new Service.Switch(this.name + " NoGo Lines", "noGoLines");
		this.extraCareService = new Service.Switch(this.name + " Extra Care", "extraCare");
		this.scheduleService = new Service.Switch(this.name + " Schedule", "schedule");
		this.findMeService = new Service.Switch(this.name + " Find Me", "findMe");

		SpotWidthCharacteristic = require('../characteristics/spotWidth')(Characteristic, CustomUUID);
		SpotHeightCharacteristic = require('../characteristics/spotHeight')(Characteristic, CustomUUID);
		SpotRepeatCharacteristic = require('../characteristics/spotRepeat')(Characteristic, CustomUUID);

		// Spot cleaning with advanced options
		if ((typeof this.availableServices.spotCleaning !== 'undefined') && this.availableServices.spotCleaning.includes("basic"))
		{
			this.spotCleanAdvancedService = new Service.Switch(this.name + " Clean Spot", "cleanSpot");
			this.spotCleanAdvancedService.addCharacteristic(SpotRepeatCharacteristic);
			this.spotCleanAdvancedService.addCharacteristic(SpotWidthCharacteristic);
			this.spotCleanAdvancedService.addCharacteristic(SpotHeightCharacteristic);
		}
		// Spot cleaning without advanced options
		else
		{
			this.spotCleanSimpleService = new Service.Switch(this.name + " Clean Spot", "cleanSpot");
			this.spotCleanSimpleService.addCharacteristic(SpotRepeatCharacteristic);
		}
		this.log("Added default cleaning device named: " + this.name);
	}
	else
	{
		const splitName = boundary.name.split(' ');
		let serviceName = "Clean the " + boundary.name;
		if (splitName.length >= 2 && splitName[splitName.length - 2].match(/[']s$/g))
		{
			serviceName = "Clean " + boundary.name;
		}
		this.cleanBoundaryService = new Service.Switch(serviceName, "cleanBoundary:" + boundary.id);
		this.log("Added zone cleaning for: " + boundary.name);
	}
}

NeatoVacuumRobotAccessory.prototype = {
	identify: function (callback)
	{
		this.robot.getState((error, result) =>
		{
			if (error)
			{
				this.log.error("Error getting robot information: " + error + ": " + result);
			}
			else
			{
				this.log("### Robot information ###");
				this.log(result);
			}
			callback();
		});
	},

	getServices: function ()
	{
		this.informationService = new Service.AccessoryInformation();
		this.informationService
		.setCharacteristic(Characteristic.Manufacturer, "Neato Robotics")
		.setCharacteristic(Characteristic.Model, this.meta.modelName)
		.setCharacteristic(Characteristic.SerialNumber, this.robot._serial)
		.setCharacteristic(Characteristic.FirmwareRevision, this.meta.firmware);
		if (typeof this.boundary === "undefined")
		{
			this.informationService
			.setCharacteristic(Characteristic.Name, this.robot.name)
		}
		else
		{
			this.informationService
			.setCharacteristic(Characteristic.Name, this.robot.name + ' - ' + this.boundary.name)
		}

		this.services = [this.informationService];

		if (typeof this.boundary === "undefined")
		{
			this.cleanService.getCharacteristic(Characteristic.On).on('set', (on, serviceCallback) =>
			{
				this.setClean(on, serviceCallback, this.boundary)
			});
			this.cleanService.getCharacteristic(Characteristic.On).on('get', (serviceCallback) =>
			{
				this.getClean(serviceCallback, this.boundary);
			});

			// Create services
			this.goToDockService.getCharacteristic(Characteristic.On).on('set', this.setGoToDock.bind(this));
			this.goToDockService.getCharacteristic(Characteristic.On).on('get', this.getGoToDock.bind(this));
			this.dockStateService.getCharacteristic(Characteristic.OccupancyDetected).on('get', this.getDock.bind(this));

			this.ecoService.getCharacteristic(Characteristic.On).on('set', this.setEco.bind(this));
			this.ecoService.getCharacteristic(Characteristic.On).on('get', this.getEco.bind(this));

			this.noGoLinesService.getCharacteristic(Characteristic.On).on('set', this.setNoGoLines.bind(this));
			this.noGoLinesService.getCharacteristic(Characteristic.On).on('get', this.getNoGoLines.bind(this));

			this.extraCareService.getCharacteristic(Characteristic.On).on('set', this.setExtraCare.bind(this));
			this.extraCareService.getCharacteristic(Characteristic.On).on('get', this.getExtraCare.bind(this));

			this.scheduleService.getCharacteristic(Characteristic.On).on('set', this.setSchedule.bind(this));
			this.scheduleService.getCharacteristic(Characteristic.On).on('get', this.getSchedule.bind(this));

			this.findMeService.getCharacteristic(Characteristic.On).on('set', this.setFindMe.bind(this));
			this.findMeService.getCharacteristic(Characteristic.On).on('get', this.getFindMe.bind(this));

			this.batteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
			this.batteryService.getCharacteristic(Characteristic.ChargingState).on('get', this.getBatteryChargingState.bind(this));

			if (typeof this.spotCleanAdvancedService !== 'undefined')
			{
				this.spotCleanAdvancedService.getCharacteristic(Characteristic.On).on('set', this.setSpotClean.bind(this));
				this.spotCleanAdvancedService.getCharacteristic(Characteristic.On).on('get', this.getSpotClean.bind(this));
				this.spotCleanAdvancedService.getCharacteristic(SpotRepeatCharacteristic).on('set', this.setSpotRepeat.bind(this));
				this.spotCleanAdvancedService.getCharacteristic(SpotRepeatCharacteristic).on('get', this.getSpotRepeat.bind(this));
				this.spotCleanAdvancedService.getCharacteristic(SpotWidthCharacteristic).on('set', this.setSpotWidth.bind(this));
				this.spotCleanAdvancedService.getCharacteristic(SpotWidthCharacteristic).on('get', this.getSpotWidth.bind(this));
				this.spotCleanAdvancedService.getCharacteristic(SpotHeightCharacteristic).on('set', this.setSpotHeight.bind(this));
				this.spotCleanAdvancedService.getCharacteristic(SpotHeightCharacteristic).on('get', this.getSpotHeight.bind(this));

				if (this.hiddenServices.indexOf('spot') === -1)
					this.services.push(this.spotCleanAdvancedService);
			}
			else
			{
				this.spotCleanSimpleService.getCharacteristic(Characteristic.On).on('set', this.setSpotClean.bind(this));
				this.spotCleanSimpleService.getCharacteristic(Characteristic.On).on('get', this.getSpotClean.bind(this));
				this.spotCleanSimpleService.getCharacteristic(SpotRepeatCharacteristic).on('set', this.setSpotRepeat.bind(this));
				this.spotCleanSimpleService.getCharacteristic(SpotRepeatCharacteristic).on('get', this.getSpotRepeat.bind(this));

				if (this.hiddenServices.indexOf('spot') === -1)
					this.services.push(this.spotCleanSimpleService);
			}

			// Add primary services
			this.services.push(this.cleanService);
			this.services.push(this.batteryService);

			// Add optional services
			if (this.hiddenServices.indexOf('dock') === -1)
				this.services.push(this.goToDockService);
			if (this.hiddenServices.indexOf('dockstate') === -1)
				this.services.push(this.dockStateService);
			if (this.hiddenServices.indexOf('eco') === -1)
				this.services.push(this.ecoService);
			if (this.hiddenServices.indexOf('nogolines') === -1)
				this.services.push(this.noGoLinesService);
			if (this.hiddenServices.indexOf('extracare') === -1)
				this.services.push(this.extraCareService);
			if (this.hiddenServices.indexOf('schedule') === -1)
				this.services.push(this.scheduleService);
			// if (this.hiddenServices.indexOf('find') === -1)
			// 	this.services.push(this.vacuumRobotFindMeService);
		}
		else
		{
			this.cleanBoundaryService.getCharacteristic(Characteristic.On).on('set', (on, serviceCallback) =>
			{
				this.setClean(on, serviceCallback, this.boundary)
			});
			this.cleanBoundaryService.getCharacteristic(Characteristic.On).on('get', (serviceCallback) =>
			{
				this.getClean(serviceCallback, this.boundary);
			});
			this.services.push(this.cleanBoundaryService);
		}

		return this.services;
	},


	getClean: function (callback, boundary)
	{
		this.platform.updateRobot(this.robot._serial, (error, result) =>
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

			debug(this.name + ": Cleaning is " + (cleaning ? 'ON' : 'OFF'));
			callback(false, cleaning);
		});
	},

	setClean: function (on, callback, boundary)
	{
		debug(this.name + ": " + (on ? "Enabled " : "Disabled") + " Clean " + boundary);
		this.platform.updateRobot(this.robot._serial, (error, result) =>
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
						debug(this.name + ": ## Resume cleaning");
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
						debug(this.name + ": ## Returning to dock to start cleaning of new room");
						this.setGoToDock(true, (error, result) =>
						{
							this.nextRoom = boundary;
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
					debug(this.name + ": ## Pause cleaning");
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

	clean: function (callback, boundary, spot)
	{
		// Start automatic update while cleaning
		if (this.refresh === 'auto')
		{
			setTimeout(() =>
			{
				this.platform.updateRobotTimer(this.robot._serial);
			}, 60 * 1000);
		}

		let eco = this.robotObject.mainAccessory.ecoService.getCharacteristic(Characteristic.On).value;
		let extraCare = this.robotObject.mainAccessory.extraCareService.getCharacteristic(Characteristic.On).value;
		let nogoLines = this.robotObject.mainAccessory.noGoLinesService.getCharacteristic(Characteristic.On).value;
		let room = (typeof boundary === 'undefined' || boundary === null) ? '' : boundary.name;
		debug(this.name + ": ## Start cleaning (" + (room !== '' ? room + " " : '') + "eco: " + eco + ", extraCare: " + extraCare + ", nogoLines: " + nogoLines + ", spot: " + JSON.stringify(spot) + ")");

		// Normal cleaning
		if (room === '' && (typeof spot === 'undefined'))
		{
			this.robot.startCleaning(eco, extraCare ? 2 : 1, nogoLines, (error, result) =>
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
		else if (room !== '')
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
		// Spot cleaning
		else
		{
			this.robot.startSpotCleaning(eco, spot.width, spot.height, spot.repeat, extraCare ? 2 : 1, (error, result) =>
			{
				if (error)
				{
					this.log.error("Cannot start spot cleaning. " + error + ": " + JSON.stringify(result));
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
		this.platform.updateRobot(this.robot._serial, (error, result) =>
		{
			if (on)
			{
				if (this.robot.canPause)
				{
					debug(this.name + ": ## Pause cleaning to go to dock");
					this.robot.pauseCleaning((error, result) =>
					{
						setTimeout(() =>
						{
							debug(this.name + ": ## Go to dock");
							this.robot.sendToBase(callback);
						}, 1000);
					});
				}
				else if (this.robot.canGoToBase)
				{
					debug(this.name + ": ## Go to dock");
					this.robot.sendToBase(callback);
				}
				else
				{
					this.log.warn(this.name + ": Can't go to dock at the moment");
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
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": Eco Mode is " + (this.robot.eco ? 'ON' : 'OFF'));
			callback(false, this.robot.eco);
		});
	},

	setEco: function (on, callback)
	{
		this.robot.eco = on;
		debug(this.name + ": " + (on ? "Enabled " : "Disabled") + " Eco Mode ");
		callback();
	},

	getNoGoLines: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": NoGoLine is " + (this.robot.eco ? 'ON' : 'OFF'));
			callback(false, this.robot.noGoLines ? 1 : 0);
		});
	},

	setNoGoLines: function (on, callback)
	{
		this.robot.noGoLines = on;
		debug(this.name + ": " + (on ? "Enabled " : "Disabled") + " NoGoLine ");
		callback();
	},

	getExtraCare: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": Care Nav is " + (this.robot.navigationMode === 2 ? 'ON' : 'OFF'));
			callback(false, this.robot.navigationMode === 2 ? 1 : 0);
		});
	},

	setExtraCare: function (on, callback)
	{
		this.robot.navigationMode = on ? 2 : 1;
		debug(this.name + ": " + (on ? "Enabled " : "Disabled") + " Care Nav ");
		callback();
	},

	getSchedule: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": Schedule is " + (this.robot.eco ? 'ON' : 'OFF'));
			callback(false, this.robot.isScheduleEnabled);
		});
	},

	setSchedule: function (on, callback)
	{
		this.platform.updateRobot(this.robot._serial, (error, result) =>
		{
			if (on)
			{
				debug(this.name + ": Enabled  Schedule");
				this.robot.enableSchedule(callback);
			}
			else
			{
				debug(this.name + ": Disabled Schedule");
				this.robot.disableSchedule(callback);
			}
		});
	},

	getFindMe: function (callback)
	{
		callback(false, false);
	},

	setFindMe: function (on, callback)
	{
		if (on)
		{
			debug(this.name + ": ## Find me");
			setTimeout(() =>
			{
				this.findMeService.setCharacteristic(Characteristic.On, false);
			}, 1000);

			this.robot.findMe(callback);
		}
	},

	getSpotClean: function (callback)
	{
		callback();
	},

	setSpotClean: function (on, callback)
	{
		let spot = {
			width: this.spotCleanService.getCharacteristic(SpotWidthCharacteristic).value,
			height: this.spotCleanService.getCharacteristic(SpotHeightCharacteristic).value,
			repeat: this.spotCleanService.getCharacteristic(SpotRepeatCharacteristic).value
		};

		this.platform.updateRobot(this.robot._serial, (error, result) =>
		{
			// Start
			if (on)
			{
				// Resume cleaning
				if (this.robot.canResume)
				{
					debug(this.name + ": ## Resume (spot) cleaning");
					this.robot.resumeCleaning(callback);
				}
				// Start cleaning
				else if (this.robot.canStart)
				{
					this.clean(callback, null, spot);
				}
				// Cannot start
				else
				{
					debug(this.name + ": Cannot start spot cleaning, maybe already cleaning");
					callback();
				}
			}
			// Stop
			else
			{
				if (this.robot.canPause)
				{
					debug(this.name + ": ## Pause cleaning");
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

	getSpotWidth: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": S width  is " + this.robot.spotWidth + "cm");
			callback(false, this.robot.spotWidth);
		});
	},

	setSpotWidth: function (width, callback)
	{
		this.robot.spotWidth = width;
		debug(this.name + ": Set spot width to " + width + "cm");
		callback();
	},

	getSpotHeight: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": S height is " + this.robot.spotHeight + "cm");
			callback(false, this.robot.spotHeight);
		});
	},

	setSpotHeight: function (height, callback)
	{
		this.robot.spotHeight = height;
		debug(this.name + ": Set spot height to " + height + "cm");
		callback();
	},

	getSpotRepeat: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": S repeat is " + (this.robot.spotRepeat ? 'ON' : 'OFF'));
			callback(false, this.robot.spotRepeat);
		});
	},

	setSpotRepeat: function (on, callback)
	{
		this.robot.spotRepeat = on;
		debug(this.name + ": " + (on ? "Enabled " : "Disabled") + " Spot repeat");
		callback();
	},

	getDock: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": The Dock is " + (this.robot.isDocked ? '' : 'NOT ') + "OCCUPIED");
			callback(false, this.robot.isDocked ? 1 : 0);
		});
	},

	getBatteryLevel: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": Battery  is " + this.robot.charge + "%");
			callback(false, this.robot.charge);
		});
	},

	getBatteryChargingState: function (callback)
	{
		this.platform.updateRobot(this.robot._serial, () =>
		{
			debug(this.name + ": Battery  is " + (this.robot.isCharging ? '' : 'NOT ') + "CHARGING");
			callback(false, this.robot.isCharging);
		});
	},

	updated: function ()
	{
		if (!this.boundary)
		{
			// only update these values if the state is different from the current one, otherwise we might accidentally start an action
			// AND dont set a clean switch to on if it's a room switch, otherwise we start the cleaning of each room at once
			if (this.cleanService.getCharacteristic(Characteristic.On).value !== this.robot.canPause && (typeof this.boundary === 'undefined'))
			{
				this.cleanService.setCharacteristic(Characteristic.On, this.robot.canPause);
			}

			// dock switch is on (dock not seen before) and dock has just been seen -> turn switch off
			if (this.goToDockService.getCharacteristic(Characteristic.On).value == true && this.robot.dockHasBeenSeen)
			{
				this.goToDockService.setCharacteristic(Characteristic.On, false);
			}

			if (this.scheduleService.getCharacteristic(Characteristic.On).value !== this.robot.isScheduleEnabled)
			{
				this.scheduleService.setCharacteristic(Characteristic.On, this.robot.isScheduleEnabled);
			}

			// no commands here, values can be updated without problems
			this.dockStateService.setCharacteristic(Characteristic.OccupancyDetected, this.robot.isDocked ? 1 : 0);

			this.ecoService.setCharacteristic(Characteristic.On, this.robot.eco);
			this.noGoLinesService.setCharacteristic(Characteristic.On, this.robot.noGoLines);
			this.extraCareService.setCharacteristic(Characteristic.On, this.robot.navigationMode == 2 ? true : false);

			if (typeof this.spotCleanAdvancedService !== 'undefined')
			{
				this.spotCleanAdvancedService.setCharacteristic(SpotWidthCharacteristic, this.robot.spotWidth);
				this.spotCleanAdvancedService.setCharacteristic(SpotHeightCharacteristic, this.robot.spotHeight);
				this.spotCleanAdvancedService.setCharacteristic(SpotRepeatCharacteristic, this.robot.spotRepeat);
			}
			else
			{
				this.spotCleanSimpleService.setCharacteristic(SpotRepeatCharacteristic, this.robot.spotRepeat);
			}
		}
		else
		{
			if (this.cleanBoundaryService.getCharacteristic(Characteristic.On).value !== this.robot.canPause)
			{
				this.cleanBoundaryService.setCharacteristic(Characteristic.On, this.robot.canPause);
			}
		}

		this.batteryService.setCharacteristic(Characteristic.BatteryLevel, this.robot.charge);
		this.batteryService.setCharacteristic(Characteristic.ChargingState, this.robot.isCharging);

		// Robot has a next room to clean in queue
		if (this.nextRoom !== null && this.robot.isDocked)
		{
			this.clean((error, result) =>
			{
				this.nextRoom = null;
				debug("## Starting cleaning of next room");
			}, this.nextRoom);
		}
	}
};