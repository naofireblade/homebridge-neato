"use strict";
var inherits = require('util').inherits,
    debug = require('debug')('homebridge-neato'),
    botvac = require('node-botvac'),

    Service,
    Characteristic;

module.exports = function (homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    homebridge.registerPlatform("homebridge-neato", "NeatoVacuumRobot", NeatoVacuumRobotPlatform);
};

function NeatoVacuumRobotPlatform(log, config) {
    this.log = log;
    this.serial = "1-3-3-7";
    this.email = config['email'];
    this.password = config['password'];
    this.hiddenServices = ('disabled' in config ? config['disabled'] : '');

    if ('refresh' in config && config['refresh'] !== 'auto') {
        // parse config parameter
        this.refresh = parseInt(config['refresh']);
        // must be integer and positive
        this.refresh = (typeof this.refresh !== 'number' || (this.refresh % 1) !== 0 || this.refresh < 0) ? 60 : this.refresh;
        // minimum 60s to save some load on the neato servers
        this.refresh = (this.refresh > 0 && this.refresh < 60) ? 60 : this.refresh;
    }
    // default auto
    else {
        this.refresh = 'auto';
    }
    debug("Refresh is set to: " + this.refresh);
}

NeatoVacuumRobotPlatform.prototype = {
    accessories: function (callback) {
        let accessories = [];

        let that = this;
        this.getRobots(function () {
            for (let i = 0; i < that.robots.length; i++) {
                that.log("Found robot #" + (i + 1) + " named \"" + that.robots[i].name + "\" with serial \"" + that.robots[i]._serial + "\"");
                let robotAccessory = new NeatoVacuumRobotAccessory(that.robots[i], that);
                accessories.push(robotAccessory);
                if (that.robots[i].maps && that.robots[i].maps.length > 0)
                {
                    that.robots[i].maps.forEach((map) => {
                        map.boundaries.forEach((boundary) => {
                            if (boundary.type === "polygon") {
                                accessories.push(new NeatoVacuumRobotAccessory(that.robots[i], that, boundary))
                            }
                        })
                    })
                }
            }
            callback(accessories);
        });
    },

    getRobots: function (callback) {
        debug("Loading your robots");
        let client = new botvac.Client();
        let that = this;
        client.authorize(this.email, this.password, false, (error) => {
            if (error) {
                that.log(error);
                that.log.error("Can't log on to neato cloud. Please check your credentials.");
                callback();
            } else {
                client.getRobots((error, robots) => {
                    if (error) {
                        that.log(error);
                        that.log.error("Successful login but can't connect to your neato robot.");
                        callback();
                    } else {
                        if (robots.length === 0) {
                            that.log.error("Successful login but no robots associated with your account.");
                            that.robots = [];
                            callback();
                        } else {
                            debug("Found " + robots.length + " robots");
                            let updatedRobotCount = 0;
                            that.robots = robots;
                            that.robots.forEach((robot) => {
                                robot.getPersistentMaps((error, result) => {
                                    if (error) {
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
                                    robot.maps.forEach((map) => {
                                        robot.getMapBoundaries(map.id, (error, result) => {
                                            if (error) {
                                                this.log("error getting boundaries: " + error + ": " + result)
                                            } else {
                                                map.boundaries = result.boundaries;
                                            }
                                            processedMapCount++;
                                            if (processedMapCount == robot.maps.length) {
                                                updatedRobotCount++;
                                                if (updatedRobotCount === that.robots.length) {
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

function NeatoVacuumRobotAccessory(robot, platform, boundary) {
    this.platform = platform;
    this.boundary = boundary;
    this.log = platform.log;
    this.refresh = platform.refresh;
    this.hiddenServices = platform.hiddenServices;
    this.robot = robot;
    if (!this.boundary) {
        this.name = robot.name;
    } else {
        this.name = this.robot.name + ' - ' + this.boundary.name;
    }
    this.lastUpdate = null;

    this.vacuumRobotBatteryService = new Service.BatteryService("Battery", "battery");

    if (!this.boundary) {
        this.vacuumRobotCleanService = new Service.Switch("Clean", "clean");
        this.vacuumRobotGoToDockService = new Service.Switch(this.name + " Go to Dock", "goToDock");
        this.vacuumRobotDockStateService = new Service.OccupancySensor(this.name + " Dock", "dockState");
        this.vacuumRobotEcoService = new Service.Switch(this.name + " Eco Mode", "eco");
        this.vacuumRobotNoGoLinesService = new Service.Switch(this.name + " NoGo Lines", "noGoLines");
        this.vacuumRobotExtraCareService = new Service.Switch(this.name + " Extra Care", "extraCare");
        this.vacuumRobotScheduleService = new Service.Switch(this.name + " Schedule", "schedule");
    } else {
        const splitName = boundary.name.split(' ');
        let serviceName = "Clean the " + boundary.name;
        if (splitName.length >= 2 && splitName[splitName.length - 2].match(/[']s$/g)) {
            serviceName = "Clean " + boundary.name;
        }
        this.vacuumRobotCleanBoundaryService =
            new Service.Switch(serviceName, "cleanBoundary:" + boundary.id);
        this.log("Adding zone cleaning for: " + boundary.name);
    }

    this.updateRobotTimer();
}


NeatoVacuumRobotAccessory.prototype = {
    identify: function (callback) {
        let that = this;
        this.updateRobot(function () {
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

    getServices: function () {
        this.informationService = new Service.AccessoryInformation();
        this.informationService
            .setCharacteristic(Characteristic.Manufacturer, "Neato Robotics")
            .setCharacteristic(Characteristic.Model, "Coming soon")
            .setCharacteristic(Characteristic.SerialNumber, this.robot._serial);
        if (!this.boundary) {
            this.informationService
                .setCharacteristic(Characteristic.Name, this.robot.name)
        } else {
            this.informationService
                .setCharacteristic(Characteristic.Name, this.robot.name + ' - ' + this.boundary.name)
        }

        this.vacuumRobotBatteryService.getCharacteristic(Characteristic.BatteryLevel).on('get', this.getBatteryLevel.bind(this));
        this.vacuumRobotBatteryService.getCharacteristic(Characteristic.ChargingState).on('get', this.getBatteryChargingState.bind(this));

        this.services = [this.informationService, this.vacuumRobotBatteryService];

        if (!this.boundary) {
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

        if (this.boundary) {
            this.vacuumRobotCleanBoundaryService.getCharacteristic(Characteristic.On).on('set', (on, serviceCallback) => {
                this.setCleanBoundary(this.boundary.id, on, serviceCallback)
            });
            this.vacuumRobotCleanBoundaryService.getCharacteristic(Characteristic.On).on('get', (serviceCallback) => {
                this.getCleanBoundary(this.boundary.id, serviceCallback);
            });
            this.services.push(this.vacuumRobotCleanBoundaryService);
        }

        return this.services;
    },

    setCleanBoundary: function (boundaryId, on, callback) {
        this.updateRobot((error, result) => {
            if (on) {
                if (this.robot.canStart) {
                    this.log("Starting to clean: " + boundaryId);
                    this.robot.startCleaningBoundary(this.eco, this.extraCare, boundaryId, (error, result) => {
                        if (error) {
                            this.log(error + ": " + JSON.stringify(result));
                        }
                        callback();
                    });
                    return
                } else {
                    this.log("Error, robot is already cleaning");
                }
            } else {
                if (this.robot.canPause) {
                    debug(this.name + ": Pause cleaning");
                    this.robot.pauseCleaning(callback);
                    return;
                } else {
                    debug(this.name + ": Already stopped");
                }
            }
            callback();
        });
    },

    getCleanBoundary: function (boundaryId, callback) {
        this.updateRobot((error, result) => {
            callback(false, this.robot.canPause && (this.robot.cleaningBoundaryId == boundaryId));
        });
    },

    setClean: function (on, callback) {
        let that = this;
        this.updateRobot(function (error, result) {
            if (on) {
                if (that.robot.canResume || that.robot.canStart) {

                    // start extra update robot timer if refresh is set to "auto"
                    if (that.refresh === 'auto') {
                        setTimeout(function () {
                            clearTimeout(that.timer);
                            that.updateRobotTimer();
                        }, 60 * 1000);
                    }

                    if (that.robot.canResume) {
                        debug(that.name + ": Resume cleaning");
                        that.robot.resumeCleaning(callback);
                    } else {
                        let eco = that.vacuumRobotEcoService.getCharacteristic(Characteristic.On).value;
                        let extraCare = that.vacuumRobotExtraCareService.getCharacteristic(Characteristic.On).value;
                        let nogoLines = that.vacuumRobotNoGoLinesService.getCharacteristic(Characteristic.On).value;
                        debug(that.name + ": Start cleaning (eco: " + eco + ", extraCare: " + extraCare + ", nogoLines: " + nogoLines + ")");
                        that.robot.startCleaning(
                            eco,
                            extraCare ? 2 : 1,
                            nogoLines,
                            function (error, result) {
                                if (error) {
                                    that.log.error(error + ": " + result);
                                    callback(true);
                                } else {
                                    callback();
                                }
                            });
                    }
                } else {
                    debug(that.name + ": Cant start, maybe already cleaning");
                    callback();
                }
            } else {
                if (that.robot.canPause) {
                    debug(that.name + ": Pause cleaning");
                    that.robot.pauseCleaning(callback);
                } else {
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
                        setTimeout(function () {
                            debug("Go to dock");
                            that.robot.sendToBase(callback);
                        }, 1000);
                    });
                } else if (that.robot.canGoToBase) {
                    debug(that.name + ": Go to dock");
                    that.robot.sendToBase(callback);
                } else {
                    that.log.warn(that.name + ": Can't go to dock at the moment");
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

    setNoGoLines: function (on, callback) {
        debug(this.name + ": " + (on ? "Enable nogo lines" : "Disable nogo lines"));
        this.robot.noGoLines = on;
        callback();
    },

    setExtraCare: function (on, callback) {
        debug(this.name + ": " + (on ? "Enable extra care navigation" : "Disable extra care navigation"));
        this.robot.navigationMode = on ? 2 : 1;
        callback();
    },

    setSchedule: function (on, callback) {
        let that = this;
        this.updateRobot(function (error, result) {
            if (on) {
                debug(that.name + ": Enable schedule");
                that.robot.enableSchedule(callback);
            } else {
                debug(that.name + ": Disable schedule");
                that.robot.disableSchedule(callback);
            }
        });
    },

    getClean: function (callback) {
        let that = this;
        this.updateRobot(function (error, result) {
            debug(that.name + ": Is cleaning: " + that.robot.canPause);
            callback(false, that.robot.canPause);
        });
    },

    getGoToDock: function (callback) {
        callback(false, false);
    },

    getDock: function (callback) {
        let that = this;
        this.updateRobot(function () {
            debug(that.name + ": Is docked: " + that.robot.isDocked);
            callback(false, that.robot.isDocked ? 1 : 0);
        });
    },

    getEco: function (callback) {
        let that = this;
        this.updateRobot(function () {
            debug(that.name + ": Is eco: " + that.robot.eco);
            callback(false, that.robot.eco);
        });
    },

    getNoGoLines: function (callback) {
        let that = this;
        this.updateRobot(function () {
            debug(that.name + ": Is nogo lines: " + that.robot.noGoLines);
            callback(false, that.robot.noGoLines ? 1 : 0);
        });
    },

    getExtraCare: function (callback) {
        let that = this;
        this.updateRobot(function () {
            debug(that.name + ": Is extra care navigation: " + (that.robot.navigationMode == 2 ? true : false));
            callback(false, that.robot.navigationMode == 2 ? 1 : 0);
        });
    },

    getSchedule: function (callback) {
        let that = this;
        this.updateRobot(function () {
            debug(that.name + ": Is schedule: " + that.robot.isScheduleEnabled);
            callback(false, that.robot.isScheduleEnabled);
        });
    },


    getBatteryLevel: function (callback) {
        let that = this;
        this.updateRobot(function () {
            debug(that.name + ": Battery: " + that.robot.charge + "%");
            callback(false, that.robot.charge);
        });
    },

    getBatteryChargingState: function (callback) {
        let that = this;
        this.updateRobot(function () {
            debug(that.name + ": Is charging: " + that.robot.isCharging);
            callback(false, that.robot.isCharging);
        });
    },

    updateRobot: function (callback) {
        let that = this;
        if (this.lastUpdate !== null && new Date() - this.lastUpdate < 2000) {
            callback();
        } else {
            debug(this.name + ": Updating robot state");
            this.robot.getState(function (error, result) {
                if (error) {
                    that.log.error(error + ": " + result);
                }
                that.lastUpdate = new Date();
                callback();
            });
        }
    },

    updateRobotTimer: function () {
        let that = this;
        this.updateRobot((error, result) => {

            if (!this.boundary) {
                // only update these values if the state is different from the current one, otherwise we might accidentally start an action
                if (that.vacuumRobotCleanService.getCharacteristic(Characteristic.On).value !== that.robot.canPause) {
                    that.vacuumRobotCleanService.setCharacteristic(Characteristic.On, that.robot.canPause);
                }

                // dock switch is on (dock not seen before) and dock has just been seen -> turn switch off
                if (that.vacuumRobotGoToDockService.getCharacteristic(Characteristic.On).value == true && that.robot.dockHasBeenSeen) {
                    that.vacuumRobotGoToDockService.setCharacteristic(Characteristic.On, false);
                }

                if (that.vacuumRobotScheduleService.getCharacteristic(Characteristic.On).value !== that.robot.isScheduleEnabled) {
                    that.vacuumRobotScheduleService.setCharacteristic(Characteristic.On, that.robot.isScheduleEnabled);
                }

                // no commands here, values can be updated without problems
                that.vacuumRobotDockStateService.setCharacteristic(Characteristic.OccupancyDetected, that.robot.isDocked ? 1 : 0);
                that.vacuumRobotEcoService.setCharacteristic(Characteristic.On, that.robot.eco);
                that.vacuumRobotNoGoLinesService.setCharacteristic(Characteristic.On, that.robot.noGoLines);
                that.vacuumRobotExtraCareService.setCharacteristic(Characteristic.On, that.robot.navigationMode == 2 ? true : false);

            } else {
                if (this.vacuumRobotCleanBoundaryService.getCharacteristic(Characteristic.On).value !== that.robot.canPause) {
                    this.vacuumRobotCleanBoundaryService.setCharacteristic(Characteristic.On, that.robot.canPause);
                }
            }

            that.vacuumRobotBatteryService.setCharacteristic(Characteristic.BatteryLevel, that.robot.charge);
            that.vacuumRobotBatteryService.setCharacteristic(Characteristic.ChargingState, that.robot.isCharging);

            // robot is currently cleaning, update if refresh is set to auto or a specific interval
            if (that.robot.canPause && that.refresh !== 0) {
                let refreshTime = that.refresh === 'auto' ? 60 : that.refresh;
                debug("Updating state in background every " + refreshTime + " seconds while cleaning");
                that.timer = setTimeout(that.updateRobotTimer.bind(that), refreshTime * 1000);
            }
            // robot is not cleaning, but a specific refresh interval is set
            else if (that.refresh !== 'auto' && that.refresh !== 0) {
                debug("Updating state in background every " + that.refresh + " seconds (user setting)");
                that.timer = setTimeout(that.updateRobotTimer.bind(that), that.refresh * 1000);
            } else {
                debug("Updating state in background disabled");
            }
        });
    },
};
