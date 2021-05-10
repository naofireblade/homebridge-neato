import {CharacteristicValue, Logger, PlatformAccessory, PlatformAccessoryEvent, PlatformConfig, Service, WithUUID} from 'homebridge';
import {HomebridgeNeatoPlatform} from '../homebridgeNeatoPlatform';
import spotRepeat from '../characteristics/spotRepeat';
import spotWidth from '../characteristics/spotWidth';
import spotHeight from '../characteristics/spotHeight';
import {Options} from '../models/options';
import {CleanType, RobotService} from '../models/services';
import {ALL_SERVICES, BACKGROUND_INTERVAL, LOCALE, PREFIX} from '../defaults';
import {availableLocales, localize} from '../localization';
import {CharacteristicHandler} from '../characteristics/characteristicHandler';

/**
 * Platform Accessory
 * An instance of this class is created for each accessory your platform registers
 * Each accessory may expose multiple services of different service types.
 */
export class NeatoVacuumRobotAccessory
{
	// Homebridge
	private log: Logger;
	private readonly batteryService?: Service;
	private readonly cleanService?: Service;
	private readonly findMeService?: Service;
	private readonly goToDockService?: Service;
	private readonly dockStateService?: Service;
	private readonly binFullService?: Service;
	private readonly ecoService?: Service;
	private readonly noGoLinesService?: Service;
	private readonly extraCareService?: Service;
	private readonly scheduleService?: Service;
	private readonly spotCleanService?: Service;
	private spotPlusFeatures: boolean;

	// Context
	private robot: any;
	private readonly options: Options;

	// Config
	private readonly backgroundUpdateInterval: number;
	private readonly locale: availableLocales;
	private readonly prefix: boolean;
	private readonly availableServices: Set<RobotService>;

	// Transient
	private isSpotCleaning: boolean;
	private timer: any;

	/**
	 * These are just used to create a working example
	 * You should implement your own code to track the state of your accessory
	 */

	constructor(
			private readonly platform: HomebridgeNeatoPlatform,
			private readonly accessory: PlatformAccessory,
			private readonly config: PlatformConfig)
	{
		this.log = platform.log;

		this.robot = accessory.context.robot;
		this.options = accessory.context.options || new Options();
		this.spotPlusFeatures = false;

		this.backgroundUpdateInterval = NeatoVacuumRobotAccessory.parseBackgroundUpdateInterval(this.config['backgroundUpdate']);
		this.prefix = this.config['prefix'] || PREFIX;
		this.locale = this.config['language'] || LOCALE;
		this.availableServices = new Set(this.config['services']) || ALL_SERVICES;

		this.isSpotCleaning = false;

		// Information
		this.accessory.getService(this.platform.Service.AccessoryInformation)!
				.setCharacteristic(this.platform.Characteristic.Manufacturer, "Neato Robotics")
				.setCharacteristic(this.platform.Characteristic.Model, this.robot.meta.modelName)
				.setCharacteristic(this.platform.Characteristic.SerialNumber, this.robot._serial)
				.setCharacteristic(this.platform.Characteristic.FirmwareRevision, this.robot.meta.firmware)
				.setCharacteristic(this.platform.Characteristic.Name, this.robot.name);

		// Identify
		this.accessory.on(PlatformAccessoryEvent.IDENTIFY, () => {
			this.robot.findMe();

			this.robot.getState((error, result) => {
				this.log.info("[" + this.robot.name + "] Identified");
				if (error)
				{
					this.debug(DebugType.INFO, JSON.stringify("Error: " + error));
				}
				this.debug(DebugType.INFO, "Status: " + JSON.stringify(result));
				this.debug(DebugType.INFO,
						"Config: Background Update Interval: " + this.backgroundUpdateInterval + ", Prefix: " + this.prefix + ", Enabled services: " + JSON.stringify(this.availableServices));
			});
		});

		// Services
		this.cleanService = this.registerService(RobotService.CLEAN, this.platform.Service.Switch, [{
			characteristic: this.platform.Characteristic.On,
			getCharacteristicHandler: this.getClean.bind(this),
			setCharacteristicHandler: this.setClean.bind(this)
		}]);
		this.spotCleanService = this.registerService(RobotService.CLEAN_SPOT, this.platform.Service.Switch, [{
			characteristic: this.platform.Characteristic.On,
			getCharacteristicHandler: this.getSpotClean.bind(this),
			setCharacteristicHandler: this.setSpotClean.bind(this)
		}]);
		this.goToDockService = this.registerService(RobotService.GO_TO_DOCK, this.platform.Service.Switch, [{
			characteristic: this.platform.Characteristic.On,
			getCharacteristicHandler: this.getGoToDock.bind(this),
			setCharacteristicHandler: this.setGoToDock.bind(this)
		}]);
		this.dockStateService = this.registerService(RobotService.DOCKED, this.platform.Service.OccupancySensor, [{
			characteristic: this.platform.Characteristic.OccupancyDetected.OccupancyDetected,
			getCharacteristicHandler: this.getDocked.bind(this)
		}]);
		this.binFullService = this.registerService(RobotService.BIN_FULL, this.platform.Service.OccupancySensor, [{
			characteristic: this.platform.Characteristic.OccupancyDetected.OccupancyDetected,
			getCharacteristicHandler: this.getBinFull.bind(this)
		}]);
		this.findMeService = this.registerService(RobotService.FIND_ME, this.platform.Service.Switch, [{
			characteristic: this.platform.Characteristic.On,
			getCharacteristicHandler: this.getFindMe.bind(this),
			setCharacteristicHandler: this.setFindMe.bind(this)
		}]);
		this.scheduleService = this.registerService(RobotService.SCHEDULE, this.platform.Service.Switch, [{
			characteristic: this.platform.Characteristic.On,
			getCharacteristicHandler: this.getSchedule.bind(this),
			setCharacteristicHandler: this.setSchedule.bind(this)
		}]);
		this.ecoService = this.registerService(RobotService.ECO, this.platform.Service.Switch, [{
			characteristic: this.platform.Characteristic.On,
			getCharacteristicHandler: this.getEco.bind(this),
			setCharacteristicHandler: this.setEco.bind(this)
		}]);
		this.noGoLinesService = this.registerService(RobotService.NOGO_LINES, this.platform.Service.Switch, [{
			characteristic: this.platform.Characteristic.On,
			getCharacteristicHandler: this.getNoGoLines.bind(this),
			setCharacteristicHandler: this.setNoGoLines.bind(this)
		}]);
		this.extraCareService = this.registerService(RobotService.EXTRA_CARE, this.platform.Service.Switch, [{
			characteristic: this.platform.Characteristic.On,
			getCharacteristicHandler: this.getExtraCare.bind(this),
			setCharacteristicHandler: this.setExtraCare.bind(this)
		}]);
		this.batteryService = this.registerService(RobotService.BATTERY, this.platform.Service.Battery);

		// This should be the main switch if the accessory is grouped in homekit
		if (this.cleanService)
		{
			this.cleanService.setPrimaryService(true);
		}

		// Start background update
		this.updateRobotPeriodically().then(() => {
			// Add special characteristics to set spot cleaning options
			this.spotPlusFeatures = ((typeof this.robot.availableServices.spotCleaning !== 'undefined') && this.robot.availableServices.spotCleaning.includes("basic"));
			this.addSpotCleanCharacteristics();

			// Save/Load options
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

	private addSpotCleanCharacteristics()
	{
		// Only add characteristics if service is available ond characteristics are not added yet
		if (this.spotCleanService != null && !this.options.spotCharacteristics)
		{
			this.spotCleanService.addCharacteristic(spotRepeat(this.platform.Characteristic))
					.onGet(this.getSpotRepeat.bind(this))
					.onSet(this.setSpotRepeat.bind(this));

			// Add these only if the robot supports them
			if (this.spotPlusFeatures)
			{
				this.spotCleanService.addCharacteristic(spotWidth(this.platform.Characteristic))
						.onGet(this.getSpotWidth.bind(this))
						.onSet(this.setSpotWidth.bind(this));
				this.spotCleanService.addCharacteristic(spotHeight(this.platform.Characteristic))
						.onGet(this.getSpotHeight.bind(this))
						.onSet(this.setSpotHeight.bind(this));
			}
			this.options.spotCharacteristics = true;
		}
		else if (this.spotCleanService == null)
		{
			this.options.spotCharacteristics = false;
		}
	}

	private registerService(serviceName: RobotService, serviceType: WithUUID<typeof Service>, characteristicHandlers: CharacteristicHandler[] = []): Service | undefined
	{
		const displayName = (this.prefix ? (this.robot.name + " ") : "") + localize(serviceName, this.locale);

		// query existing service by type and subtype
		const existingService = this.accessory.getServiceById(serviceType, serviceName)

		if (this.availableServices.has(serviceName))
		{
			let service: Service;
			if (existingService && existingService.displayName === displayName)
			{
				service = existingService
			}
			else
			{
				if (existingService)
				{
					this.accessory.removeService(existingService);
				} // delete to reset display name in case of locale or prefix change
				service = this.accessory.addService(serviceType, displayName, serviceName);
			}
			characteristicHandlers.forEach(ch => {
				let char = service.getCharacteristic(ch.characteristic);
				if (ch.getCharacteristicHandler)
				{
					char.onGet(ch.getCharacteristicHandler)
				}
				if (ch.setCharacteristicHandler)
				{
					char.onSet(ch.setCharacteristicHandler)
				}
			});
			return service
		}
		else
		{
			if (existingService)
			{
				this.accessory.removeService(existingService);
			}
		}
	}

	private static parseBackgroundUpdateInterval(configValue: any)
	{
		// Parse as number
		let backgroundUpdateInterval = parseInt(configValue) || BACKGROUND_INTERVAL;

		// must be integer and positive
		backgroundUpdateInterval = ((backgroundUpdateInterval % 1) !== 0 || backgroundUpdateInterval < 0) ? BACKGROUND_INTERVAL : backgroundUpdateInterval;

		return backgroundUpdateInterval;
	}

	async getClean(): Promise<CharacteristicValue>
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

	async setClean(on: CharacteristicValue)
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
					await this.clean(CleanType.ALL)
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
				if (this.goToDockService)
				{
					this.goToDockService.updateCharacteristic(this.platform.Characteristic.On, false);
				}
			}, 10000);

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
					this.log.warn("[" + this.robot.name + "] Can't go to dock at the moment");
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

	getSpotRepeat()
	{
		return this.options.spotRepeat;
	}

	setSpotRepeat(on: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set SPOT REPEAT: " + on);
		this.options.spotRepeat = <boolean>on;
	}

	getSpotWidth()
	{
		return this.options.spotWidth;
	}

	setSpotWidth(length: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set SPOT WIDTH: " + length + " cm");
		this.options.spotWidth = <number>length;
	}

	getSpotHeight()
	{
		return this.options.spotHeight;
	}

	setSpotHeight(length: CharacteristicValue)
	{
		this.debug(DebugType.STATUS, "Set SPOT HEIGHT: " + length + " cm");
		this.options.spotHeight = <number>length;
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
				if (this.findMeService)
				{
					this.findMeService.updateCharacteristic(this.platform.Characteristic.On, false);
				}
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
		}, 2 * 60 * 1000);

		this.log.info(
				"[" + this.robot.name + "] > Start cleaning with options type: " + CleanType[cleanType] + ", eco: " + this.options.eco + ", noGoLines: " + this.options.noGoLines + ", extraCare: "
				+ this.options.extraCare);

		try
		{
			switch (cleanType)
			{
				case CleanType.ALL:
					await this.robot.startCleaning(this.options.eco, this.options.extraCare ? 2 : 1, this.options.noGoLines);
					break;
				case CleanType.SPOT:
					await this.robot.startSpotCleaning(this.options.eco, this.options.spotWidth, this.options.spotHeight, this.options.spotRepeat, this.options.extraCare ? 2 : 1);
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
					this.batteryService?.updateCharacteristic(this.platform.Characteristic.BatteryLevel, this.robot.charge);
					this.batteryService?.updateCharacteristic(this.platform.Characteristic.ChargingState, this.robot.isCharging);
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
			interval = this.backgroundUpdateInterval;
		}

		this.debug(DebugType.INFO, "Background update done. Next update in " + interval + " minute" + (interval == 1 ? "" : "s") + ((this.robot.canPause) ? ", robot is currently cleaning." : "."));
		this.timer = setTimeout(this.updateRobotPeriodically.bind(this), interval * 60 * 1000);
	}

	async updateCharacteristics()
	{
		if (this.cleanService)
		{
			this.cleanService.updateCharacteristic(this.platform.Characteristic.On, await this.getClean());
		}
		if (this.spotCleanService)
		{
			this.spotCleanService.updateCharacteristic(this.platform.Characteristic.On, await this.getSpotClean());
		}
		if (this.goToDockService)
		{
			this.goToDockService.updateCharacteristic(this.platform.Characteristic.On, await this.getGoToDock());
		}
		if (this.dockStateService)
		{
			this.dockStateService.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, await this.getDocked());
		}
		if (this.binFullService)
		{
			this.binFullService.updateCharacteristic(this.platform.Characteristic.OccupancyDetected, await this.getBinFull());
		}
		if (this.scheduleService)
		{
			this.scheduleService.updateCharacteristic(this.platform.Characteristic.On, await this.getSchedule());
		}
	}

	private debug(debugType: DebugType, message: String)
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


enum DebugType
{
	ACTION,
	STATUS,
	INFO
}