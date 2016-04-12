#! /usr/bin/env node

const fs = require('fs');
const path = require('path');
const _ = require('lodash');
const percent = require('percent');
const dotRemover = require('./utils/dotRemover');
const glob = require('glob');

const locale = 'en-gb';

const args = process.argv.slice(2);

const componentToBase = args[0];

function compareConfigs(arr) {

    const common = {};

    function checkAllOthers(indexNotToCheck, key, value) {
        const amountToPass = arr.length - 1;
        var found = 0;
        arr.forEach(function (config, index) {
            if (index === indexNotToCheck) {
                return;
            }
            if (config[key] === value || _.isEqual(config[key], value)) {
                found++;
            }
        });
        return (percent.calc(found, amountToPass, 0)) > 75;
    }

    arr.forEach(function (config, index) {
        Object.keys(config).forEach(function (key) {
            if (checkAllOthers(index, key, config[key])) {
                common[key] = config[key];
            }
        });
    });

    return common;
}

// options is optional
glob(path.join(process.cwd(), 'app/pageconfig/**/', locale, '/*.json'), function (er, files) {

    const componentMap = {};

    // Start - Get all components and then push all their possible configs into an array
    files.forEach(function (pageconfig) {
        const file = fs.readFileSync(pageconfig, 'utf-8');
        const parsedConfig = JSON.parse(file);
        if (!parsedConfig.slots) {
            return;
        }
        Object.keys(parsedConfig.slots).forEach(function (slot) {
            if (parsedConfig.slots[slot].components) {
                parsedConfig.slots[slot].components.forEach(function (component) {
                    if (!componentMap[component.type]) {
                        componentMap[component.type] = [];
                    }

                    componentMap[component.type].push((component.configuration || {
                        noConfig: true
                    }));
                });
            }
        });
    });
    // End - Get all components and then push all their possible configs into an array


    // Start - Calculate the similarites in the arrays and merge it all into one common config per component
    const baseConfigs = {};

    Object.keys(componentMap).forEach(function (component) {
        if (componentMap[component].length === 1) {
            baseConfigs[component] = componentMap[component][0];
            return;
        }
        baseConfigs[component] = compareConfigs(componentMap[component]);
    });
    // End - Calculate the similarites in the arrays and merge it all into one common config per component

    // Iterate through base config and remove any stragglers (Those with no config or no base config)
    Object.keys(baseConfigs).forEach(function (componentName) {
        if (baseConfigs[componentName].noConfig || Object.keys(baseConfigs[componentName]).length === 0) {
            delete baseConfigs[componentName];
        }
    });
    //End

    if (componentToBase) {
        //remove everything but compoonent to base
        Object.keys(baseConfigs).forEach(function (componentName) {
            if (componentName !== componentToBase) {
                delete baseConfigs[componentName];
            }
        });
        //
    }

    //Start - Add Page configs to components
    const componentNames = fs.readdirSync(path.join(process.cwd(), 'app/components')).filter(dotRemover);
    componentNames.forEach(function (componentName) {
        if (!baseConfigs[componentName]) {
            return;
        }

        try {
            fs.mkdirSync(path.join(process.cwd(), 'app/components', componentName, 'config'));
            fs.mkdirSync(path.join(process.cwd(), 'app/components', componentName, 'config', locale));
        } catch (e) {

        }

        fs.writeFileSync(path.join(process.cwd(), 'app/components', componentName, 'config', locale, 'index.json'), JSON.stringify(baseConfigs[componentName], null, 4), 'utf8');

    });
    //End - Add page configs to components

    //Start - Iterate over page and remove any components with keys in the base config
    var counter = 0;
    files.forEach(function (pageconfig) {

        const file = fs.readFileSync(pageconfig, 'utf-8');
        const parsedConfig = JSON.parse(file);
        if (!parsedConfig.slots) {
            return;
        }
        var flagFileForRewrite;

        Object.keys(parsedConfig.slots).forEach(function (slot) {

            if (parsedConfig.slots[slot].components) {
                parsedConfig.slots[slot].components.forEach(function (component, componentIndex) {
                    if (!component.configuration) {
                        return;
                    }
                    Object.keys(component.configuration).forEach(function (configKey) {
                        if (baseConfigs[component.type]) {
                            if ((baseConfigs[component.type][configKey] === component.configuration[configKey]) || _.isEqual(baseConfigs[component.type][configKey], component.configuration[configKey])) {
                                flagFileForRewrite = true;
                                delete parsedConfig.slots[slot].components[componentIndex].configuration[configKey];
                            }
                        }
                    });
                });
            }
        });

        //Remove empty configs
        Object.keys(parsedConfig.slots).forEach(function (slot) {
            if (parsedConfig.slots[slot].components) {
                parsedConfig.slots[slot].components.forEach(function (component, componentIndex) {
                    if (component.configuration && Object.keys(component.configuration).length === 0) {
                        delete parsedConfig.slots[slot].components[componentIndex].configuration;
                    }
                });
            }
        });

        if (flagFileForRewrite) {
            fs.writeFileSync(pageconfig, JSON.stringify(parsedConfig, null, 4), 'utf8');
        }
    });
    //End - Iterate over page and remove any components with keys in the base config

});
