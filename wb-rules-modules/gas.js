//  session - time between guard activate/deactivate
//  session_max_shots
//    0 - infinity
//    X - number of fire shots for each session

// TODO: check after reboot
// TODO: enabled/disabled - prevent/react current

var MODULE_NAME 		= "gas_manager";
var MODULE_VERSION  = "v.1.10";

var data = {};

exports.start = function(config) {
	if (!validateConfig(config)) return;

	//  init data  //
	data[config.id] = {};
	data[config.id].timer_shotDuration = null;

	//  device  //
	createDevice(config);

	//  rules  //
	createRule_BTN_sessionReset(config.id, config.onGone);
	createRule_BTN_test(config.id);
	createRule_VALUE_gas(config.id, config.onShot, config.onGone);
	config.sensors.forEach( function(item) {
		createRule_externalSensor(config.id,
				item.device,
		  	item.control,
		  	item.name,
				(item.activationValue !== null && item.activationValue !== undefined) ? item.activationValue : 1);
		createRule_VALUE_sensor(config.id, item.name);
	});
	if (config.valve) {
		createRule_BTN_valve_close(config.id, config.valve.device, config.valve.control);
	}

  log(config.id + ": Started (" + MODULE_NAME + " " + MODULE_VERSION + ")");
};

//  Validate config  //

var validateConfig = function(_config) {
  if (!_config) {
    log("Error: " + MODULE_NAME + ": No config");
    return false;
  }

  if (!_config.id || !_config.id.length) {
    log("Error: " + MODULE_NAME + ": Config: Bad id");
    return false;
  }

  if (!_config.title || !_config.title.length) {
    log("Error: " + MODULE_NAME + ": Config: Bad title");
    return false;
  }

  if (_config.valve) {
		if (!_config.valve.device || !_config.valve.control) {
		  log("Error: " + MODULE_NAME + ": Config: Bad valve");
		  return false;
		}
	}

  if (!_config.sensors) {
    log("Error: " + MODULE_NAME + ": Config: No sensors");
    return false;
  }

  return true;
}

//
//  Device  //
//

function createDevice(config) {
	var cells = {
		enabled: 								{ type: "switch", value: true },
		version: 								{ type: "text", value: MODULE_VERSION },
		shot_timeout_sec: 			{ type: "range",  max: 300, value: 60 },
		session_max_shots: 			{ type: "range",  max: 10, 	value: 3 },
		session_shots_counter: 	{ type: "value", 	value: 0 },
		session_reset: 					{ type: "pushbutton" },
		gas: 										{ type: "value", 	value: 0 },
		test: 									{ type: "pushbutton" },
	}

	if (config.valve) {
		cells.valve_close = { type: "pushbutton" };
	}

	config.sensors.forEach( function(item) {
	  cells[item.name] = { type: "value", value: 0 };
	});

	defineVirtualDevice(config.id, {
	  title: config.title,
	  cells: cells
	});
}

//
//  Btn: Close valve (set power for 5 seconds)  //
//

function createRule_BTN_valve_close(device_id, valve_device, valve_control) {
	defineRule({
    whenChanged: device_id + "/valve_close",
    then: function (newValue, devName, cellName) {
			if(dev[valve_device][valve_control] === true) return;

			dev[valve_device][valve_control] = true;
			log(device_id + ": Valve close");

			setTimeout(function() {
				dev[valve_device][valve_control] = false;
				log("Valve release");
			}, 5000)
		}
	});
}

//
//  Btn: Test  //
//

function createRule_BTN_test(device_id) {
	defineRule({
    whenChanged: device_id + "/test",
    then: function (newValue, devName, cellName) {
			//  set smoke  //
			if(dev[device_id]["gas"] !== 1) dev[device_id]["gas"] = 1;
		}
	});
}

//
//  Gas detected  //
//

function createRule_VALUE_gas(device_id, cb_onShot, cb_onGone) {
	defineRule({
    whenChanged: device_id + "/gas",
    then: function (newValue, devName, cellName) {
			//  check smoke found  //
			if (!newValue) return;

			//  close valve if exists  //
			if (dev[device_id]["valve_close"] !== null) dev[device_id]["valve_close"] = true;

			//  increment shots and emit  //
    	if (dev[device_id]["session_max_shots"] !== 0) {
    		dev[device_id]["session_shots_counter"] += 1;
				if (cb_onShot) cb_onShot(dev[device_id]["session_shots_counter"]);
    	} else {
				if (cb_onShot) cb_onShot(0);
    	}

      //  start timer if neccessery  //
			// if (timer_shotDuration) clearTimeout(timer_shotDuration); // already checked
			if(!dev[device_id]["shot_timeout_sec"]) return;
      data[device_id].timer_shotDuration = setTimeout(function() {
				data[device_id].timer_shotDuration = null;
				dev[device_id]["gas"] = 0;
      	//  gone  //
	      if (cb_onGone) cb_onGone();
      }, dev[device_id]["shot_timeout_sec"] * 1000);
		}
	});
}

//
//  Sensor -> device sensor  //
//

function createRule_externalSensor(device_id, device, control, name, activationValue) {
	defineRule({
    whenChanged: device + "/" + control,
    then: function (newValue, devName, cellName) {

    	//  get values  //
    	var value = (newValue == activationValue) ? 1 : 0;

			//  save new  //
      if (dev[device_id][name] !== value) dev[device_id][name] = value;
		}
	});
}

//
//  Device sensor changed  //
//

function createRule_VALUE_sensor(device_id, name) {
	defineRule({
    whenChanged: device_id + "/" + name,
    then: function (newValue, devName, cellName) {
			//  check smoke found  //
			if (!newValue) return;

			//  check enabled  //
      if (!dev[device_id]["enabled"]) return;

			//  check session max shots  //
    	if (dev[device_id]["session_max_shots"] !== 0
    	&& dev[device_id]["session_shots_counter"] >= dev[device_id]["session_max_shots"]) return;

			//  check already found  //
			if (dev[device_id]["gas"]) return;

			//  set smoke  //
			dev[device_id]["gas"] = 1;
		}
	});
}

//
//  Btn: Reset  //
//

function createRule_BTN_sessionReset(device_id, cb_onGone) {
  defineRule({
    whenChanged: device_id + "/session_reset",
    then: function (newValue, devName, cellName)  {
			//  clear smoke flag  //
			if (dev[device_id]["gas"] !== 0) dev[device_id]["gas"] = 0;

			//  clear shots counter  //
      dev[device_id]["session_shots_counter"] = 0;

			//  clear timer  //
			if (data[device_id].timer_shotDuration) {
				clearTimeout(data[device_id].timer_shotDuration);
				data[device_id].timer_shotDuration = null;
			}

			if (cb_onGone) cb_onGone();
    }
  });
}
