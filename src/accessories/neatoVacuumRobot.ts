import {CharacteristicValue, Logger, PlatformAccessory, PlatformAccessoryEvent, PlatformConfig, Service} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';
import {Options} from '../models/options';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class NeatoVacuumRobotAccessory
{
	private robot: any;
	private log: Logger;
	private readonly refresh: any;
	private isSpotCleaning: boolean;
	private readonly options: Options;
	private timer: any;

	private batteryService: Service;
	private cleanService: Service;
	private findMeService: Service;
	private goToDockService: Service;
	private dockStateService: Service;
	private binFullService: Service;
	private ecoService: Service;
	private noGoLinesService: Service;
	private extraCareService: Service;
	private scheduleService: Service;
	private spotCleanService: Service;

	/**
	 * These are just used to create a working example
	 * You should implement your own code to track the state of your accessory
	 */

	constructor(
			private readonly platform: HomebridgeNeatoPlatform,
			private readonly accessory: PlatformAccessory,
			private readonly isNew: Boolean,
			private readonly config: PlatformConfig)
	{
		this.log = platform.log;
		this.robot = accessory.context.robot;
		this.options = accessory.context.options || new Options();

		if ('refresh' in this.config && this.config['refresh'] !== 'auto')
		{
			// parse config parameter
			this.refresh = parseInt(this.config['refresh']);
			// must be integer and positive
			this.refresh = (typeof this.refresh !== 'number' || (this.refresh % 1) !== 0 || this.refresh < 0) ? 60 : this.refresh;
			// minimum 60s to save some load on the neato servers
			if (this.refresh > 0 && this.refresh < 60)
			{
				this.log.warn("Minimum refresh time is 60 seconds to not overload the neato servers");
				this.refresh = (this.refresh > 0 && this.refresh < 60) ? 60 : this.refresh;
			}
		}
		else
		{
			this.refresh = 'auto';
		}
		this.debug(DebugType.STATUS, "Background update interval is: " + this.refresh);

		this.isSpotCleaning = false;

		// set accessory information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
				.setCharacteristic(this.platform.Characteristic.Manufacturer, "Neato Robotics")
				.setCharacteristic(this.platform.Characteristic.Model, this.robot.meta.modelName)
				.setCharacteristic(this.platform.Characteristic.SerialNumber, this.robot._serial)
				.setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.robot.meta.firmware)
				.setCharacteristic(this.platform.Characteristic.Name, this.robot.name);

		this.accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
			this.robot.getState((error, result) => {
				this.log.info(this.robot.name + " Identified");
				if (error)
				{
					this.debug(DebugType.INFO, JSON.stringify("Error: " + error));
				}
				this.debug(DebugType.INFO, "Status: " + JSON.stringify(result));
			});
		});

		this.batteryService = this.accessory.getService(this.platform.Service.Battery) || this.accessory.addService(this.platform.Service.Battery)

		this.cleanService = this.getSwitchService(this.robot.name + " Clean House");
		this.spotCleanService = this.getSwitchService(this.robot.name + " Clean Spot");
		this.goToDockService = this.getSwitchService(this.robot.name + " Go to Dock");
		this.dockStateService = this.getOccupancyService(this.robot.name + " Docked")
		this.binFullService = this.getOccupancyService(this.robot.name + " Bin Full")
		this.findMeService = this.getSwitchService(this.robot.name + " Find Me");
		this.scheduleService = this.getSwitchService(this.robot.name + " Option: Schedule");
		this.ecoService = this.getSwitchService(this.robot.name + " Option: Eco Mode");
		this.noGoLinesService = this.getSwitchService(this.robot.name + " Option: NoGo Lines");
		this.extraCareService = this.getSwitchService(this.robot.name + " Option: Extra Care");

		this.cleanService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setCleanHouse.bind(this))
				.onGet(this.getCleanHouse.bind(this));
		this.spotCleanService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setSpotClean.bind(this))
				.onGet(this.getSpotClean.bind(this));
		this.goToDockService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setGoToDock.bind(this))
				.onGet(this.getGoToDock.bind(this));
		this.dockStateService.getCharacteristic(this.platform.Characteristic.OccupancyDetected)
				.onGet(this.getDocked.bind(this));
		this.dockStateService.getCharacteristic(this.platform.Characteristic.OccupancyDetected)
				.onGet(this.getBinFull.bind(this));
		this.findMeService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setFindMe.bind(this))
				.onGet(this.getFindMe.bind(this));
		this.scheduleService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setSchedule.bind(this))
				.onGet(this.getSchedule.bind(this));
		this.ecoService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setEco.bind(this))
				.onGet(this.getEco.bind(this));
		this.noGoLinesService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setNoGoLines.bind(this))
				.onGet(this.getNoGoLines.bind(this));
		this.extraCareService.getCharacteristic(this.platform.Characteristic.On)
				.onSet(this.setExtraCare.bind(this))
				.onGet(this.getExtraCare.bind(this));

		this.updateRobotPeriodically().then(() => {
			if (!accessory.context.options)
			{
				this.options.eco = this.robot.eco;
				this.options.noGoLines = this.robot.noGoLines;
				this.options.extraCare = this.robot.navigationMode == 2;
				this.debug(DebugType.INFO, "Options initially set to eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: " + this.options.extraCare);
				accessory.context.options = this.options;
			}
			else
			{
				this.debug(DebugType.INFO, "Options loaded from cache eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: " + this.options.extraCare);
			}
		});
	}

	private getSwitchService(servicename: string)
	{
		return this.accessory.getService(servicename) || this.accessory.addService(this.platform.Service.Switch, servicename, servicename)
	}

	private getOccupancyService(servicename: string)
	{
		return this.accessory.getService(servicename) || this.accessory.addService(this.platform.Service.OccupancySensor, servicename, servicename)
	}

	async getCleanHouse(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.canPause && !this.isSpotCleaning;
		}
		catch (error)
		{
			this.log.error("Cannot get cleaning status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async setCleanHouse(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set CLEAN HOUSE: " + on);
		try
		{
			await this.updateRobot();

			// Start
			if (on)
			{
				// Resume cleaning
				if (this.robot.canResume)
				{
					this.debug(DebugType.ACTION, "Resume cleaning");
					await this.robot.resumeCleaning();
				}
				// Start cleaning
				else if (this.robot.canStart)
				{
					await this.clean(CleanType.HOUSE)
				}
				// Cannot start
				else
				{
					this.debug(DebugType.INFO, "Cannot start, maybe already cleaning (expected)");
				}
			}
			// Stop
			else
			{
				if (this.robot.canPause)
				{
					this.debug(DebugType.ACTION, "Pause cleaning");
					await this.robot.pauseCleaning();
				}
				else
				{
					this.debug(DebugType.INFO, "Already paused");
				}
			}
		}
		catch (error)
		{
			this.log.error("Error setting cleaning to: " + on + ". " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async getSpotClean(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.canPause && this.isSpotCleaning;
		}
		catch (error)
		{
			this.log.error("Cannot get spot cleaning status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async setSpotClean(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set SPOT CLEAN: " + on);
		try
		{
			if (on)
			{
				await this.clean(CleanType.SPOT)
			}
			else
			{
				// TODO stop/pause
			}
		}
		catch (error)
		{
			this.log.error("Error setting spot cleaning to: " + on + ". " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	getGoToDock()
	{
		return false;
	}

	async setGoToDock(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set GO TO DOCK: " + on);
		if (on)
		{
			await this.updateRobot();

			setTimeout(() => {
				this.goToDockService.updateCharacteristic(this.platform.Characteristic.On, false);
			}, 1000);

			try
			{
				if (this.robot.canPause)
				{
					this.debug(DebugType.ACTION, "Pause cleaning to go to dock");
					await this.robot.pauseCleaning();
					setTimeout(async () => {
						await this.robot.sendToBase();
					}, 1000);
				}
				else if (this.robot.canGoToBase)
				{
					this.debug(DebugType.ACTION, "Going to dock");
					await this.robot.sendToBase();
				}
				else
				{
					this.log.warn(this.robot.name + "=| Can't go to dock at the moment");
				}
			}
			catch (error)
			{
				this.log.error("Error setting go to dock to: " + on + ". " + error);
				throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}
		}
	}

	async getDocked(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.isDocked;
		}
		catch (error)
		{
			this.log.error("Cannot get docked status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async getBinFull(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.isBinFull;
		}
		catch (error)
		{
			this.log.error("Cannot get bin full status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async getSchedule(): Promise<CharacteristicValue>
	{
		try
		{
			await this.updateRobot();
			return this.robot.isScheduleEnabled;
		}
		catch (error)
		{
			this.log.error("Cannot get schedule status: " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	async setSchedule(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set SCHEDULE: " + on);
		try
		{
			if (on)
			{
				await this.robot.enableSchedule();
			}
			else
			{
				await this.robot.disableSchedule();
			}
		}
		catch (error)
		{
			this.log.error("Error setting schedule to: " + on + ". " + error);
			throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
		}
	}

	getEco()
	{
		return this.options.eco;
	}

	setEco(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set ECO: " + on);
		this.options.eco = <boolean>on;
	}

	getExtraCare()
	{
		return this.options.extraCare;
	}

	setExtraCare(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set EXTRA CARE: " + on);
		this.options.extraCare = <boolean>on;
	}

	getNoGoLines()
	{
		return this.options.noGoLines;
	}

	setNoGoLines(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set NOGO LINES: " + on);
		this.options.noGoLines = <boolean>on;
	}

	getFindMe()
	{
		return false;
	}

	async setFindMe(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set FIND ME: " + on);
		if (on)
		{
			this.debug(DebugType.ACTION, "Find me");
			setTimeout(() => {
				this.findMeService.updateCharacteristic(this.platform.Characteristic.On, false);
			}, 1000);

			try
			{
				await this.robot.findMe();
			}
			catch (error)
			{
				this.log.error(this.robot.name + " ## Cannot start find me. " + error);
				throw new this.platform.api.hap.HapStatusError(this.platform.api.hap.HAPStatus.SERVICE_COMMUNICATION_FAILURE);
			}
		}
	}

	async clean(cleanType: CleanType)
	{
		// Enable shorter background update while cleaning
		setTimeout(() => {
			this.updateRobotPeriodically();
		}, 60 * 1000);

		this.log.info("[" + this.robot.name + "] > Start cleaning with options type: " + CleanType[cleanType] + ", eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: " + this.options.extraCare);

		try
		{
			switch (cleanType)
			{
				case CleanType.HOUSE:
					await this.robot.startCleaning(this.options.eco, this.options.extraCare ? 2 : 1, this.options.noGoLines);
					break;
				case CleanType.SPOT:
					await this.robot.startSpotCleaning(this.options.eco, this.options.spot.width, this.options.spot.height, this.options.spot.repeat, this.options.extraCare ? 2 : 1);
					break;
			}
		}
		catch (error)
		{
			this.log.error("Cannot start cleaning. " + error);
		}
	}

	async updateRobot()
	{
		// Data is outdated
		if (typeof (this.robot.lastUpdate) === 'undefined' || new Date().getTime() - this.robot.lastUpdate > 2000)
		{
			this.robot.lastUpdate = new Date().getTime();
			try
			{
				this.robot.getState((error, result) => {
					this.isSpotCleaning = result != null && result.action == 2;

					// Battery
					this.batteryService.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.robot.charge);
					this.batteryService.updateCharacteristic(this.platform.Characteristic.ChargingState, this.robot.isCharging);
				});
			}
			catch (error)
			{
				this.log.error("Cannot update robot " + this.robot.name + ". Check if robot is online. " + error);
				return false;
			}
		}
	}

	async updateRobotPeriodically()
	{
		this.debug(DebugType.INFO, "Performing background update")

		await this.updateRobot()
		await this.updateCharacteristics();

		// Clear any other overlapping timers for this robot
		clearTimeout(this.timer);

		// Tell all accessories of this robot (mainAccessory and roomAccessories) that updated robot data is available
		// this.robot.mainAccessory.updated();
		// this.robot.roomAccessories.forEach(accessory => {
		// 	accessory.updated();
		// });

		// Periodic refresh interval set in config
		let interval;
		if (this.robot.canPause)
		{
			interval = 1;
		}
		else
		{
			interval = this.refresh == "auto" ? 30 : this.refresh;
		}
		
		this.debug(DebugType.INFO, "Background update done. Next update in " + interval + " minute(s)" + ((this.robot.canPause) ? ", robot is currently cleaning" : ""));
		this.timer = setTimeout(this.updateRobotPeriodically.bind(this), interval * 60 * 1000);
	}

	async updateCharacteristics()
	{
		// Update Switches
		// Clean
		this.cleanService.updateCharacteristic(this.platform.Characteristic.On, await this.getCleanHouse());

		// Spot Clean
		this.spotCleanService.updateCharacteristic(this.platform.Characteristic.On, await this.getSpotClean());

		// Go To Dock
		this.goToDockService.updateCharacteristic(this.platform.Characteristic.On, await this.getGoToDock());

		// Docked
		this.dockStateService.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, await this.getDocked());
		
		// Bin full
		this.binFullService.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, await this.getBinFull());

		// Schedule
		this.scheduleService.updateCharacteristic(this.platform.Characteristic.On, await this.getSchedule());

		// Eco
		this.ecoService.updateCharacteristic(this.platform.Characteristic.On, await this.getEco());

		// Extra Care
		this.extraCareService.updateCharacteristic(this.platform.Characteristic.On, await this.getExtraCare());

		// NoGo Lines
		this.noGoLinesService.updateCharacteristic(this.platform.Characteristic.On, await this.getNoGoLines());
	}

	debug(debugType: DebugType, message: String)
	{
		switch (debugType)
		{
			case DebugType.ACTION:
				this.log.debug("[" + this.robot.name + "] > " + message);
				break;
			case DebugType.STATUS:
				this.log.debug("[" + this.robot.name + "] " + message);
				break;
			case DebugType.INFO:
				this.log.debug("[" + this.robot.name + "] " + message);
				break;
		}
	}
}

enum CleanType
{
	HOUSE,
	SPOT
}

enum DebugType
{
	ACTION,
	STATUS,
	INFO
}