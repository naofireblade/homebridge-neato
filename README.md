# homebridge-neato
[![npm](https://img.shields.io/npm/v/homebridge-neato.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-neato)
[![npm](https://img.shields.io/npm/dt/homebridge-neato.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-neato)
[![GitHub last commit](https://img.shields.io/github/last-commit/naofireblade/homebridge-neato.svg?style=flat-square)](https://github.com/naofireblade/homebridge-neato)

This is a plugin for [homebridge](https://github.com/nfarina/homebridge) to control your [Neato](https://www.neatorobotics.com/) vacuum robot. You can download it via [npm](https://www.npmjs.com/package/homebridge-neato).

Feel free to leave any feedback [here](https://github.com/naofireblade/homebridge-neato/issues).

If you update from a previous version 0.3.x you have to adapt your config (plugin is now a platform).

## Features

- Start and pause cleaning
- Return to dock\*
- Enable and disable schedule
- Enable and disable eco mode
- Get battery info
- Get dock info
- Periodic refresh of robot state
- Support for multiple robots
- Extra care navigation

\* Available after some seconds of cleaning.

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-neato`
3. If you don't have a Neato account yet create one [here](https://www.neatorobotics.com/create-account/).
4. Update your configuration file. See the sample below.

## Configuration

Add the following information to your config file. Change the values for email and password.

### Simple

```json
"platforms": [
	{
		"platform": "NeatoVacuumRobot",
		"email": "YourEmail",
		"password": "YourPassword"
	}
]
```

### Advanced

The following config contains advanced optional settings that are off when not specified.

The parameter **refresh** sets in what interval (seconds) changes of the robot state will be pushed to homekit. The minimum refresh time is 60 seconds. You need this only when you set up rules based on the robot state and start him outside of homekit (e.g. with the Neato app).

The parameter **extraCareNavigation** sets if supporting models (currently Neato D3 and D5) should take extra care of your furniture while cleaning.

The parameter **disabled** accepts a list of switches/sensors that can be disabled in the neato homekit plugin (e.g. dock, dockstate, eco, schedule).

```json
"platforms": [
	{
		"platform": "NeatoVacuumRobot",
		"email": "YourEmail",
		"password": "YourPassword",
		"refresh": "120",
		"extraCareNavigation": true,
		"disabled": ["dock", "dockstate", "eco"]
	}
]
```

## Tested robots

- BotVac Connected (Firmware 2.2.0)
- BotVac D3 Connected
- BotVac D5 Connected (Firmware 4.0.0-1632)

If you have another connected neato robot, please [tell me](https://github.com/naofireblade/homebridge-neato/issues) about your experience with this plugin.
