define([
    'utils'
], function(utils) {
    'use strict';

    var AbsModel = Backbone.Model.extend({
        idAttribute: 'id',

        fieldsInfo: '__all__',
        excludeFieldsInfo: ['id'],

        fieldsForm: '__all__',
        excludeFieldsForm: ['id'],

        itemFields: '__all__',

        notyOptions: {
            layout: 'topRight',
            timeout: false,
            dismissQueue: false,
            animation: {
                open: 'animated flipInX',
                close: 'animated flipOutX'
            }
        },

        urlRoot: function() {
            return '/rest/' + this.server_name + '/';
        },

        parse: function(response) {
            if (response.count === 0) {
                this.trigger('record-not-exist');
                return;
            } else if (response.count === 1) {
                response = response.results[0];
            };

            var record = response.fields;
            record[this.idAttribute] = response.pk;
            this.__unicode__ = response.__unicode__;
            return record;
        },

        getName: function() {
            if (_.isUndefined(this.__unicode__)) {
                return this.verbose_name;
            };
            return this.__unicode__;
        },

        getFieldsInfo: function() {
            var fields = _.keys(this.schema);
            if (this.fieldsInfo !== '__all__') {
                fields = this.fieldsInfo;
            };
            fields = _.difference(fields, this.excludeFieldsInfo);

            return fields;
        },

        getFieldsForm: function() {
            var fields = _.keys(this.schema);
            if (this.fieldsForm !== '__all__') {
                fields = this.fieldsForm;
            };
            fields = _.difference(fields, this.excludeFieldsForm);

            return fields;
        },

        getItemFields: function() {
            var fields = _.keys(this.schema);
            if (this.itemFields !== '__all__') {
                fields = this.itemFields;
            };

            return fields;
        },

        beforeSend: function(xhr) {
            xhr.setRequestHeader('X-CSRFToken', utils.getCsrfToken());
        },

        attachCsrfToXhr: function(options) {
            if (options) {
                if (_.isUndefined(options.beforeSend)) {
                    options.beforeSend = this.beforeSend;
                };
            } else {
                options = {};
                options.beforeSend = this.beforeSend;
            }

            return options;
        },

        getChanged: function(attrs) {
            var modelAttrs = this.toJSON(),
                changed = {},
                modelValue;

            _.each(attrs, function(value, key, t) {
                modelValue = modelAttrs[key];
                if (_.isObject(modelAttrs[key])) {
                    modelValue = modelAttrs[key].db;
                } else {
                    modelValue = modelAttrs[key];
                }

                if (modelValue !== value) {
                    changed[key] = value;
                };
            })

            return changed;
        },

        formatToSave: function(attrs) {
            var complex_values = _.each(attrs, function(value, key, list) {
                if (_.isObject(value)) {
                    if (value.db) {
                        list[key] = value.db;
                    } else {
                        list[key] = null;
                    }
                };
            });

            return attrs;
        },

        fetch: function(options) {
            if (_.isUndefined(options) && !_.isUndefined(this.request_params)) {
                options = {
                    data: this.request_params
                };
            };

            return Backbone.Model.prototype.fetch.call(this, options);
        },

        save: function(attrs, options) {
            var data, dataToSave;

            if (!attrs) {
                attrs = this.toJSON();
            };

            if (!this.isNew()) {
                attrs = this.getChanged(attrs);
                if (!_.isEmpty(attrs)) {
                    attrs[this.idAttribute] = this.id;
                };
            };

            dataToSave = this.formatToSave(attrs);
            if (_.isEmpty(dataToSave)) {
                this.trigger('not-changed');
                return false;
            };

            options = this.attachCsrfToXhr(options);
            options['wait'] = true;

            if (!options.success) {
                options.success = this.saveSuccess.bind(this);
            };
            if (!options.error) {
                options.error = this.saveError.bind(this);
            };

            data = JSON.stringify({
                'data': [dataToSave],
                'pk_field': this.idAttribute
            });
            options['data'] = data;

            return Backbone.Model.prototype.save.call(this, attrs, options);
        },

        destroy: function(options) {
            var _this = this;
            options = this.attachCsrfToXhr(options);
            options['wait'] = true;

            if (!options.success) {
                options.success = this.deleteSuccess.bind(this);
            };

            if (options.ask) {
                require([
                    'jquery',
                    'bootstrap',
                    'bootstrap-modal'
                ], function($, bootstrap, BootstrapModal) {
                    var modal = new Backbone.BootstrapModal({
                        content: 'Вы уверены, что хотите удалить объект «' + _this.getName() + '»',
                        center: true,
                        animate: true,
                        cancel: false,
                        backdrop: 'static',
                        className: 'modal delete-dialog'
                    });

                    modal.on('ok', function() {
                        Backbone.Model.prototype.destroy.call(_this, options);
                    });

                    modal.open();
                })
            } else {
                return Backbone.Model.prototype.destroy.call(this, options);
            }
        },

        saveSuccess: function(model, resp, options) {
            if (options.noty) {
                if (resp.status === 'success') {
                    this.showSaveNoty('success', options.notyOptions);
                } else {
                    this.showSaveNoty('fail', options.notyOptions);
                }
            };

            if (resp.status === 'success') {
                this.trigger('save-success');
            } else {
                this.trigger('save-fail');
            };
        },

        saveError: function(model, resp, options) {
            this.set(this.previousAttributes());
            this.showSaveNoty('fail', options.notyOptions);
            this.trigger('save-fail');
        },

        deleteSuccess: function(model, resp, options) {
            if (options.noty) {
                if (resp.status === 'success') {
                    this.showDeleteNoty('success', options.notyOptions);
                } else {
                    this.showDeleteNoty('fail', options.notyOptions);
                }
            };

            if (resp.status === 'success') {
                this.trigger('delete-success');
            } else {
                this.trigger('delete-fail');
            };
        },

        showSaveNoty: function(status, options) {
            var _this = this;

            require([
                'jquery',
                'libs/noty/js/noty/packaged/jquery.noty.packaged.min'
            ], function($, noty) {
                if (_.isUndefined(options)) {
                    var text, type;

                    if (status === 'success') {
                        text = 'Успешно сохранено';
                        type = 'success';
                    } else {
                        //другую анимацию при ошибке???
                        text = 'Ошибка при сохранении';
                        type = 'error';
                    }

                    _this.notyOptions.text = text;
                    _this.notyOptions.type = type;
                    _this.notyOptions.layout = 'topRight';
                    _this.notyOptions.timeout = 3000;
                };

                var n = noty(_this.notyOptions);
            })
        },

        showDeleteNoty: function(status, options) {
            var _this = this;

            require([
                'jquery',
                'libs/noty/js/noty/packaged/jquery.noty.packaged.min'
            ], function($, noty) {
                if (_.isUndefined(options)) {
                    var text, type;

                    if (status === 'success') {
                        text = 'Успешно удалено';
                        type = 'success';
                    } else {
                        //другую анимацию при ошибке???
                        text = 'Ошибка при удалении';
                        type = 'error';
                    }

                    _this.notyOptions.text = text;
                    _this.notyOptions.type = type;
                    _this.notyOptions.layout = 'topRight';
                    _this.notyOptions.timeout = 3000;
                };

                var n = noty(_this.notyOptions);
            })
        }
    });

    return AbsModel;
})
