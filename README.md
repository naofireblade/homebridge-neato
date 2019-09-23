# homebridge-neato
[![npm](https://img.shields.io/npm/v/homebridge-neato.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-neato)
[![npm](https://img.shields.io/npm/dt/homebridge-neato.svg?style=flat-square)](https://www.npmjs.com/package/homebridge-neato)
[![GitHub last commit](https://img.shields.io/github/last-commit/naofireblade/homebridge-neato.svg?style=flat-square)](https://github.com/naofireblade/homebridge-neato)

This is a plugin for [homebridge](https://github.com/nfarina/homebridge) to control your [Neato](https://www.neatorobotics.com/) vacuum robot. You can download it via [npm](https://www.npmjs.com/package/homebridge-neato).

If you like this plugin, I would be very grateful for your support:

<a href="https://www.buymeacoffee.com/2D1nUuK36" target="_blank"><img width="140" src="https://bmc-cdn.nyc3.digitaloceanspaces.com/BMC-button-images/custom_images/orange_img.png" alt="Buy Me A Coffee"></a>

Feel free to leave any feedback [here](https://github.com/naofireblade/homebridge-neato/issues).

## Features

- Start and pause house cleaning
  - Eco mode
  - Extra care navigation
  - Nogo lines
  - Zones
- Spot cleaning
  - 2x2 or 4x4
  - repeat
- Return to dock
- Find the robot
- Enable/Disable the schedule
- Robot information
  - battery level
  - charging state
  - dock occupancy
  - model and firmware version
- Automatic and periodic refresh for notifications
- Multiple robots

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

The parameter **refresh** is default set to auto and updates the robot state when the cleaning was started via homekit so that you can activate automations after the cleaning is done. If you want to get robot state updates after starting the cleaning from the neato app or a schedule, you have to set refresh to a static value in seconds e.g. `120`. You can disable background updates completely by setting this to `0`.

The parameter **disabled** accepts a list of switches/sensors that can be disabled in the neato homekit plugin (e.g. `dock`, `dockstate`, `eco`, `schedule`, `findme`, `spot`, `spotrepeat`, `spot4x4`).

```json
"platforms": [
	{
		"platform": "NeatoVacuumRobot",
		"email": "YourEmail",
		"password": "YourPassword",
		"refresh": "120",
		"disabled": ["dock", "dockstate", "eco", "nogolines", "extracare", "schedule", "spot"]
	}
]
```

## Tested robots

- BotVac Connected
- BotVac D3 Connected
- BotVac D4 Connected
- BotVac D5 Connected
- BotVac D6 Connected
- BotVac D7 Connected

## Contributors
Many thanks go to
- [ghulands](https://github.com/ghulands) for finding and fixing a bug when no robot is associated with the neato account
- [Berkay](https://github.com/btutal) for adding the schema file to use the plugin with homebridge-config-ui-x
- [Antoine de Maleprade](https://github.com/az0uz) for adding the zone cleaning feature
- [DJay](https://github.com/DJay-X) for testing out new beta versions