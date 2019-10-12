# homebridge-neato
[![npm](https://img.shields.io/npm/v/homebridge-neato)](https://www.npmjs.com/package/homebridge-neato)
[![npm](https://img.shields.io/npm/dt/homebridge-neato)](https://www.npmjs.com/package/homebridge-neato?activeTab=versions)
[![GitHub last commit](https://img.shields.io/github/last-commit/naofireblade/homebridge-neato)](https://github.com/naofireblade/homebridge-neato)

This is a plugin for [homebridge](https://github.com/nfarina/homebridge) to control your [Neato](https://www.neatorobotics.com/) vacuum robot. You can download it via [npm](https://www.npmjs.com/package/homebridge-neato).

If you like this plugin and find it useful, I would be forever grateful for your support:

<a href="https://www.buymeacoffee.com/2D1nUuK36" target="_blank"><img width="140" src="https://bmc-cdn.nyc3.digitaloceanspaces.com/BMC-button-images/custom_images/orange_img.png" alt="Buy Me A Coffee"></a>

Feel free to leave any feedback [here](https://github.com/naofireblade/homebridge-neato/issues).

## Features

- House Cleaning
  - Eco mode
  - Extra care navigation
  - Nogo lines
- Zone cleaning* (only D7)
- Spot cleaning
  - Individual spot size (only D7)
  - Clean twice
- Return to dock
- Find the robot
- Schedule (de)activation
- Robot information
  - Battery level
  - Charging state
  - Dock occupancy
  - Model and firmware version
- Automatic or periodic refresh of robot state
- Multiple robots

>*You can also send the robot from one room to another. He will return to the base, wait there some seconds and then starts cleaning the other room.

## Installation

1. Install homebridge using: `npm install -g homebridge`
2. Install this plugin using: `npm install -g homebridge-neato`
3. If you don't have a Neato account yet, create one [here](https://www.neatorobotics.com/create-account/).
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

The parameter **refresh** is default set to `auto` and updates the robot state when a cleaning was started via homekit so that you can activate automations based on a successful cleaning. If you want to get robot state updates after starting the cleaning from outside of homekit as well (neato app or schedule), you have to set refresh to a static value in seconds e.g. `120`. You can disable background updates completely by setting this to `0`.

The parameter **hidden** accepts a list of switches/sensors that can be hidden from homekit (e.g. `dock`, `dockstate`, `eco`, `nogolines`, `extracare`, `schedule`, `find`, `spot`).

```json
"platforms": [
	{
		"platform": "NeatoVacuumRobot",
		"email": "YourEmail",
		"password": "YourPassword",
		"refresh": "120",
		"hidden": ["dock", "dockstate", "eco", "nogolines", "extracare", "schedule", "find", "spot"]
	}
]
```

## Tested robots

The plugin is successfully tested with all Neato Connected Robots.

## Contributors
Many thanks go to
- [ghulands](https://github.com/ghulands) for finding and fixing a bug when no robot is associated with the neato account
- [Berkay](https://github.com/btutal) for adding the schema file to use the plugin with homebridge-config-ui-x
- [Antoine de Maleprade](https://github.com/az0uz) for adding the zone cleaning feature
- [DJay](https://github.com/DJay-X) for testing out tons of new beta versions