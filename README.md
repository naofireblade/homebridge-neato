# homebridge-neato
[![npm](https://img.shields.io/npm/v/homebridge-neato.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-neato)
[![npm](https://img.shields.io/npm/dt/homebridge-neato.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-neato)
[![GitHub last commit](https://img.shields.io/github/last-commit/naofireblade/homebridge-neato.svg?style=flat-square)](https://github.com/naofireblade/homebridge-neato)

This is a plugin for [homebridge](https://github.com/nfarina/homebridge) to control your [Neato](https://www.neatorobotics.com/) vacuum robot. You can download it via [npm](https://www.npmjs.com/package/homebridge-neato).

Feel free to leave any feedback [here](https://github.com/naofireblade/homebridge-neato/issues).

If you update from a previous version 0.3.x you have to adapt your config (plugin is now a platform).

## Features

- Start and pause cleaning
- Return to dock
- Toggle schedule
- Toggle eco mode
- Toggle extra care navigation
- toggle nogo lines
- Get battery info
- Get dock info
- Periodic refresh of robot state
- Support for multiple robots

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

The following config contains advanced optional settings.

The parameter **refresh** sets an interval in seconds that is used to update the robot state in the background. This is only required for automations based on the robot state. The default value is `auto` which means that the update is automatically enabled while cleaning and disabled while not cleaning. You can set a value in seconds e.g. `120` to enable background updates even when the robot is not cleaning. You can also disable background updates completely by setting the value `0`. This might be required if you experience timeouts in the app because you have other home automation apps that are connected to your robot.

The parameter **disabled** accepts a list of switches/sensors that can be disabled in the neato homekit plugin (e.g. dock, dockstate, eco, schedule).

```json
"platforms": [
	{
		"platform": "NeatoVacuumRobot",
		"email": "YourEmail",
		"password": "YourPassword",
		"refresh": "120",
		"disabled": ["dock", "dockstate", "eco", "nogolines", "extracare", "schedule"]
	}
]
```

## Tested robots

- BotVac Connected (Firmware 2.2.0)
- BotVac D3 Connected
- BotVac D5 Connected (Firmware 4.0.0, Firmware 4.3.0)
- BotVac D7 Connected

The plugin should work with D4 and D6 as well. If you have connected neato robot, please [tell me](https://github.com/naofireblade/homebridge-neato/issues) about your experience with this plugin.

## Contributors
Many thanks go to
- [ghulands](https://github.com/ghulands) for finding and fixing a bug when no robot is associated with the neato account