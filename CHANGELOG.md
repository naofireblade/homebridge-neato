## 0.1.0

* Added start and pause cleaning
* Added return to base
* Added enable and disable schedule
* Added enable and disable eco mode
* Added battery info

## 0.2.0

* Added dock info
* Improved logging to use a debug library

## 0.2.1

* Improved the go to dock command

## 0.3.0

* Added periodic refresh of robot state while cleaning
* Added optional periodic refresh of robot state while not cleaning
* Added error messages when cant login or get robot
* Improved go to dock switch to be enabled as soon as possible without manual refresh
* Improved switches to indicate the time an action needs to complete
* Improved eco mode to not be overwritten by robot state update

## 0.3.1

* Added support for Neato BotVac D5 Connected

## 0.3.2

* Fixed a bug that refresh is not disabled when set to 0

## 0.4.0

* Added support for multiple robots
* Added log output when user requests accessory identify
* Changed plugin to platform instead of single accessory
* Removed parameter name from config

## 0.4.1

* Added config parameter for extraCareNavigation

## 0.4.2

* Added config parameter to disable switches/sensors

## 0.4.4

* Fixed config parameter to disable switches/sensors not optional

## 0.4.5

* Fixed compatibility with homebridge 0.4.23 (occupancy sensor not working)

## 0.4.6

* Added error log while refreshing robot state
* Fixed a rare bug where the robot stops after some seconds of cleaning

## 0.4.7

* Fixed an exception when no robot is associated with the account

## 0.5.0

* Added noGo lines button
* Added extra care navigation button
* Added syncing cleaning options from last run
* Added option to disable background state update completely
* Changed goto dock button is now always off
* Changed error handling
* Changed debug messages
* Updated node-botvac dependency to 0.1.6
* Removed extra care navigation option parameter (is now a button)

## 0.5.1

* Updated node-botvac dependency to 0.1.7

## 0.5.2

* Added schema file for use with homebridge-config-ui-x

## 0.6.0

* Added support for zone cleaning

## 0.6.1

* Fixed homebridge startup failed when robot does not support zone cleaning

## 0.6.2

* Fixed homebridge startup failed when robot does not support mapping

## 0.6.3

* Fixed homebridge crash when robot has a map without zones
* Fixed homebridge crash when homebridge has no internet connection or the neato servers are offline
* Fixed homebridge crash when 2 zones have the same name

## 0.7.0

* Added find me function
* Added spot cleaning function with individual spot size and repeat option
* Added model and firmware information to homekit
* Added logic to be able to change the currently cleaned room
* Improved number of requests when having multiple rooms
* Fixed room switches not taking eco and extraCare mode into account
* Fixed room switches not supporting pause/resume

## 0.7.1
* Fixed robot not shown before setting up a floor plan

## 0.7.2
* Fixed homebridge crash with multiple robots per account

## 0.7.3
* Fixed warnings since homebridge 1.3.0

## 1.0.0-beta.4
* Added bin full sensor
* Added config-ui support for all options
* Added config parameter **prefix** to use robot name as prefix for service names
* Retrying mechanism if a robot is not available on homebridge launch
* Changed service names to not include robot name as prefix by default
* Changed background update to use better default intervals (1 minute while cleaning, 30 minutes while idle)
* Changed config parameter **refresh**. Renamed to **backgroundUpdate**, unit changed to minute and will only be used during idle
* Changed config parameter **hidden**. Renamed to **services**, now takes list of services that should be _visible_. Default are all available services.
* Fixed robots no longer disappear or change the room after connection issues with the Neato API
* Fixed plugin no longer crashes if non smart robot is assigned in neato account
* Fixed options for eco, nogo lines, extra care, spot repeat, spot size are now saved in homebridge and will no longer be overridden by Neato API

## TODO until 1.0.0 release
* Room cleaning