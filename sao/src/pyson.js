/* This file is part of Tryton.  The COPYRIGHT file at the top level of
   this repository contains the full copyright notices and license terms. */
(function() {
    'use strict';

    Sao.PYSON = {};
    Sao.PYSON.eval = {
        True: true,
        False: false,
    };
    Sao.PYSON.toString = function(value) {
        if (value instanceof Sao.PYSON.PYSON) {
            return value.toString();
        } else if (value instanceof Array) {
            return '[' + value.map(Sao.PYSON.toString).join(', ') + ']';
        } else if (value instanceof Object) {
            return '{' + Object.keys(value).map(key => {
                return Sao.PYSON.toString(key) + ': ' +
                    Sao.PYSON.toString(value[key]);
            }).join(', ') + '}';
        } else {
            return JSON.stringify(value);
        }
    };

    Sao.PYSON.PYSON = Sao.class_(Object, {
        init: function() {
        },
        pyson: function() {
            throw 'NotImplementedError';
        },
        types: function() {
            throw 'NotImplementedError';
        },
        get: function(k, d='') {
            return Sao.PYSON.Get(this, k, d);
        },
        in_: function(obj) {
            return Sao.PYSON.In(this, obj);
        },
        contains: function(k) {
            return Sao.PYSON.In(k, this);
        },
        toString: function() {
            var klass = this.pyson().__class__;
            var args = this.__string_params__().map(Sao.PYSON.toString);
            return klass + '(' + args.join(', ') + ')';
        },
        __string_params__: function() {
            throw 'NotImplementedError';
        }
    });

    Sao.PYSON.PYSON.eval_ = function(value, context) {
        throw 'NotImplementedError';
    };
    Sao.PYSON.PYSON.init_from_object = function(object) {
        throw 'NotImplementedError';
    };

    Sao.PYSON.Encoder = Sao.class_(Object, {
        prepare: function(value, index, parent) {
            if (value !== null && value !== undefined) {
                if (value instanceof Array) {
                    value = jQuery.extend([], value);
                    for (var i = 0, length = value.length; i < length; i++) {
                        this.prepare(value[i], i, value);
                    }
                } else if (value._isAMomentObject) {
                    if (value.isDate) {
                        value = new Sao.PYSON.Date(
                            value.year(),
                            value.month() + 1,
                            value.date()).pyson();
                    } else {
                        value = new Sao.PYSON.DateTime(
                            value.year(),
                            value.month() + 1,
                            value.date(),
                            value.hours(),
                            value.minutes(),
                            value.seconds(),
                            value.milliseconds() * 1000).pyson();
                    }
                } else if (value instanceof Sao.Decimal) {
                    value = value.valueOf();
                } else if ((value instanceof Object) &&
                    !(value instanceof Sao.PYSON.PYSON)) {
                    value = jQuery.extend({}, value);
                    for (var p in value) {
                        this.prepare(value[p], p, value);
                    }
                }
            }
            if (parent) {
                parent[index] = value;
            }
            return parent || value;
        },

        encode: function(pyson) {
            pyson = this.prepare(pyson);
            return JSON.stringify(pyson, (k, v) => {
                if (v instanceof Sao.PYSON.PYSON) {
                    return this.prepare(v.pyson());
                } else if (v === null || v === undefined) {
                    return null;
                }
                return v;
            });
        }
    });

    Sao.PYSON.Decoder = Sao.class_(Object, {
        init: function(context, noeval) {
            this.__context = context || {};
            this.noeval = noeval || false;
        },
        decode: function(str) {
            const reviver = (k, v) => {
                if (typeof v == 'object' && v !== null) {
                    var cls = Sao.PYSON[v.__class__];
                    if (cls) {
                        if (!this.noeval) {
                            return cls.eval_(v, this.__context);
                        } else {
                            var args = jQuery.extend({}, v);
                            delete args.__class__;
                            return Sao.PYSON[v.__class__].init_from_object(
                                args);
                        }
                    }
                }
                return v;
            };
            return JSON.parse(str, reviver);
        }
    });

    Sao.PYSON.eval.Eval = function(value, default_) {
        return new Sao.PYSON.Eval(value, default_);
    };
    Sao.PYSON.Eval = Sao.class_(Sao.PYSON.PYSON, {
        init: function(value, default_='') {
            Sao.PYSON.Eval._super.init.call(this);
            this._value = value;
            this._default = default_;
        },
        pyson: function() {
            return {
                '__class__': 'Eval',
                'v': this._value,
                'd': this._default
            };
        },
        types: function() {
            if (this._default instanceof Sao.PYSON.PYSON) {
                return this._default.types();
            } else {
                return [typeof this._default];
            }
        },
        __string_params__: function() {
            return [this._value, this._default];
        },
        get basename() {
            var name = this._value;
            if (name.startsWith('_parent_')) {
                name = name.slice('_parent_'.length);
            }
            var idx = name.indexOf('.');
            if (idx >= 0) {
                name = name.substring(0, idx);
            }
            return name;
        },
    });

    Sao.PYSON.Eval.eval_ = function(value, context) {
        var idx = value.v.indexOf('.');
        if ((idx >= 0) && !(value.v in context)) {
            return Sao.PYSON.Eval.eval_({
                'v': value.v.substring(idx + 1),
                'd': value.d,
            }, context[value.v.substring(0, idx)] || {});
        }
        if ((value.v in context) && (context[value.v] !== undefined)) {
            return context[value.v];
        } else {
            return value.d;
        }
    };
    Sao.PYSON.Eval.init_from_object = function(obj) {
        return new Sao.PYSON.Eval(obj.v, obj.d);
    };

    Sao.PYSON.eval.Not = function(value) {
        return new Sao.PYSON.Not(value);
    };
    Sao.PYSON.Not = Sao.class_(Sao.PYSON.PYSON, {
        init: function(value) {
            Sao.PYSON.Not._super.init.call(this);
            if (value instanceof Sao.PYSON.PYSON) {
                if (jQuery(value.types()).not(['boolean', 'object']).length ||
                    jQuery(['boolean']).not(value.types()).length) {
                    value = new Sao.PYSON.Bool(value);
                    }
            } else if (typeof value != 'boolean') {
                value = Sao.PYSON.Bool(value);
            }
            this._value = value;
        },
        pyson: function() {
            return {
                '__class__': 'Not',
                'v': this._value
                };
        },
        types: function() {
            return ['boolean'];
        },
        __string_params__: function() {
            return [this._value];
        }
    });

    Sao.PYSON.Not.eval_ = function(value, context) {
        return !value.v;
    };
    Sao.PYSON.Not.init_from_object = function(obj) {
        return new Sao.PYSON.Not(obj.v);
    };

    Sao.PYSON.eval.Bool = function(value) {
        return new Sao.PYSON.Bool(value);
    };
    Sao.PYSON.Bool = Sao.class_(Sao.PYSON.PYSON, {
        init: function(value) {
            Sao.PYSON.Bool._super.init.call(this);
            this._value = value;
        },
        pyson: function() {
            return {
                '__class__': 'Bool',
                'v': this._value
                };
        },
        types: function() {
            return ['boolean'];
        },
        __string_params__: function() {
            return [this._value];
        }
    });

    Sao.PYSON.Bool.eval_ = function(value, context) {
        if (moment.isMoment(value.v) && value.v.isTime) {
            return Boolean(value.v.hour() || value.v.minute() ||
                    value.v.second() || value.v.millisecond());
        } else if (moment.isDuration(value.v)) {
            return Boolean(value.v.valueOf());
        } else if (value.v instanceof Number) {
            return Boolean(value.v.valueOf());
        } else if (value.v instanceof Object) {
            return !jQuery.isEmptyObject(value.v);
        } else {
            return Boolean(value.v);
        }
    };
    Sao.PYSON.Bool.init_from_object = function(obj) {
        return new Sao.PYSON.Bool(obj.v);
    };


    Sao.PYSON.eval.And = function() {
        return Sao.PYSON.And.new_(arguments);
    };
    Sao.PYSON.And = Sao.class_(Sao.PYSON.PYSON, {
        init: function() {
            var statements = jQuery.extend([], arguments);
            Sao.PYSON.And._super.init.call(this);
            for (var i = 0, len = statements.length; i < len; i++) {
                var statement = statements[i];
                if (statement instanceof Sao.PYSON.PYSON) {
                    if (jQuery(statement.types()).not(['boolean']).length ||
                        jQuery(['boolean']).not(statement.types()).length) {
                        statements[i] = new Sao.PYSON.Bool(statement);
                        }
                } else if (typeof statement != 'boolean') {
                    statements[i] = new Sao.PYSON.Bool(statement);
                }
            }
            if (statements.length < 2) {
                throw 'must have at least 2 statements';
            }
            this._statements = statements;
        },
        pyson: function() {
            return {
                '__class__': 'And',
                's': this._statements
            };
        },
        types: function() {
            return ['boolean'];
        },
        __string_params__: function() {
            return this._statements;
        }
    });

    Sao.PYSON.And.eval_ = function(value, context) {
        var result = true;
        for (const statement of value.s) {
            result = result && statement;
        }
        return result;
    };
    Sao.PYSON.And.init_from_object = function(obj) {
        return Sao.PYSON.And.new_(obj.s);
    };


    Sao.PYSON.eval.Or = function() {
        return Sao.PYSON.Or.new_(arguments);
    };
    Sao.PYSON.Or = Sao.class_(Sao.PYSON.And, {
        pyson: function() {
            var result = Sao.PYSON.Or._super.pyson.call(this);
            result.__class__ = 'Or';
            return result;
        }
    });

    Sao.PYSON.Or.eval_ = function(value, context) {
        var result = false;
        for (const statement of value.s) {
            result = result || statement;
        }
        return result;
    };
    Sao.PYSON.Or.init_from_object= function(obj) {
        return new Sao.PYSON.Or.new_(obj.s);
    };

    Sao.PYSON.eval.Equal = function(statement1, statement2) {
        return new Sao.PYSON.Equal(statement1, statement2);
    };
    Sao.PYSON.Equal = Sao.class_(Sao.PYSON.PYSON, {
        init: function(statement1, statement2) {
            Sao.PYSON.Equal._super.init.call(this);
            var types1, types2;
            if (statement1 instanceof Sao.PYSON.PYSON) {
                types1 = statement1.types();
            } else {
                types1 = [typeof statement1];
            }
            if (statement2 instanceof Sao.PYSON.PYSON) {
                types2 = statement2.types();
            } else {
                types2 = [typeof statement2];
            }
            if (jQuery(types1).not(types2).length ||
                jQuery(types2).not(types1).length) {
                throw 'statements must have the same type';
                }
            this._statement1 = statement1;
            this._statement2 = statement2;
        },
        pyson: function() {
            return {
                '__class__': 'Equal',
                's1': this._statement1,
                's2': this._statement2
            };
        },
        types: function() {
            return ['boolean'];
        },
        __string_params__: function() {
            return [this._statement1, this._statement2];
        }
    });

    Sao.PYSON.Equal.eval_ = function(value, context) {
        if (value.s1 instanceof Array  && value.s2 instanceof Array) {
            return Sao.common.compare(value.s1, value.s2);
        } else if (moment.isMoment(value.s1) && moment.isMoment(value.s2)) {
            return ((value.s1.isDate == value.s2.isDate) &&
                (value.s1.isDateTime == value.s2.isDateTime) &&
                (value.s1.valueOf() == value.s2.valueOf()));
        } else {
            return value.s1 == value.s2;
        }
    };
    Sao.PYSON.Equal.init_from_object = function(obj) {
        return new Sao.PYSON.Equal(obj.s1, obj.s2);
    };

    Sao.PYSON.eval.Greater = function(statement1, statement2, equal) {
        return new Sao.PYSON.Greater(statement1, statement2, equal);
    };
    Sao.PYSON.Greater = Sao.class_(Sao.PYSON.PYSON, {
        init: function(statement1, statement2, equal=false) {
            Sao.PYSON.Greater._super.init.call(this);
            var statements = [statement1, statement2];
            for (var i = 0; i < 2; i++) {
                var statement = statements[i];
                if (statement instanceof Sao.PYSON.PYSON) {
                    if ( (!(statement instanceof Sao.PYSON.DateTime ||
                        statement instanceof Sao.PYSON.Date)) &&
                        (jQuery(statement.types()).not(['number']).length) ) {
                        throw 'statement must be an integer, float, ' +
                            'date or datetime';
                    }
                } else {
                    if (!~['number', 'object'].indexOf(typeof statement)) {
                        throw 'statement must be an integer, float, ' +
                            'date or datetime';
                    }
                }
            }
            if (equal instanceof Sao.PYSON.PYSON) {
                if (jQuery(equal.types()).not(['boolean']).length ||
                    jQuery(['boolean']).not(equal.types()).length) {
                    equal = new Sao.PYSON.Bool(equal);
                    }
            } else if (typeof equal != 'boolean') {
                equal = new Sao.PYSON.Bool(equal);
            }
            this._statement1 = statement1;
            this._statement2 = statement2;
            this._equal = equal;
        },
        pyson: function() {
            return {
                '__class__': 'Greater',
                's1': this._statement1,
                's2': this._statement2,
                'e': this._equal
            };
        },
        types: function() {
            return ['boolean'];
        },
        __string_params__: function() {
            return [this._statement1, this._statement2, this._equal];
        }
    });

    Sao.PYSON.Greater._convert = function(value) {
        value = jQuery.extend({}, value);
        var values = [value.s1, value.s2];
        for (var i=0; i < 2; i++) {
            if (values[i] instanceof moment) {
                values[i] = values[i].valueOf();
            }
            else {
                values[i] = Number(values[i]);
            }
        }
        value.s1 = values[0];
        value.s2 = values[1];
        return value;
    };

    Sao.PYSON.Greater.eval_ = function(value, context) {
        if (value.s1 == null || value.s2 == null) {
            return false;
        }
        value = Sao.PYSON.Greater._convert(value);
        if (value.e) {
            return value.s1 >= value.s2;
        } else {
            return value.s1 > value.s2;
        }
    };
    Sao.PYSON.Greater.init_from_object = function(obj) {
        return new Sao.PYSON.Greater(obj.s1, obj.s2, obj.e);
    };

    Sao.PYSON.eval.Less = function(statement1, statement2, equal) {
        return new Sao.PYSON.Less(statement1, statement2, equal);
    };
    Sao.PYSON.Less = Sao.class_(Sao.PYSON.Greater, {
        pyson: function() {
            var result = Sao.PYSON.Less._super.pyson.call(this);
            result.__class__ = 'Less';
            return result;
        }
    });

    Sao.PYSON.Less._convert = Sao.PYSON.Greater._convert;

    Sao.PYSON.Less.eval_ = function(value, context) {
        if (value.s1 == null || value.s2 == null) {
            return false;
        }
        value = Sao.PYSON.Less._convert(value);
        if (value.e) {
            return value.s1 <= value.s2;
        } else {
            return value.s1 < value.s2;
        }
    };
    Sao.PYSON.Less.init_from_object = function(obj) {
        return new Sao.PYSON.Less(obj.s1, obj.s2, obj.e);
    };

    Sao.PYSON.eval.If = function(condition, then_statement, else_statement) {
        return new Sao.PYSON.If(condition, then_statement, else_statement);
    };
    Sao.PYSON.If = Sao.class_(Sao.PYSON.PYSON, {
        init: function(condition, then_statement, else_statement=null) {
            Sao.PYSON.If._super.init.call(this);
            if (condition instanceof Sao.PYSON.PYSON) {
                if (jQuery(condition.types()).not(['boolean']).length ||
                    jQuery(['boolean']).not(condition.types()).length) {
                    condition = new Sao.PYSON.Bool(condition);
                }
            } else if (typeof condition != 'boolean') {
                condition = new Sao.PYSON.Bool(condition);
            }
            var then_types, else_types;
            if (then_statement instanceof Sao.PYSON.PYSON) {
                then_types = then_statement.types();
            } else {
                then_types = [typeof then_statement];
            }
            if (else_statement instanceof Sao.PYSON.PYSON) {
                else_types = else_statement.types();
            } else {
                else_types = [typeof else_statement];
            }
            this._condition = condition;
            this._then_statement = then_statement;
            this._else_statement = else_statement;
        },
        pyson: function() {
            return {
                '__class__': 'If',
                'c': this._condition,
                't': this._then_statement,
                'e': this._else_statement
            };
        },
        types: function() {
            var types;
            if (this._then_statement instanceof Sao.PYSON.PYSON) {
                types = this._then_statement.types();
            } else {
                types = [typeof this._then_statement];
            }
            if (this._else_statement instanceof Sao.PYSON.PYSON) {
                for (const type of this._else_statement.types()) {
                    if (!~types.indexOf(type)) {
                        types.push(type);
                    }
                }
            } else {
                const type = typeof this._else_statement;
                if (!~types.indexOf(type)) {
                    types.push(type);
                }
            }
            return types;
        },
        __string_params__: function() {
            return [this._condition, this._then_statement,
                this._else_statement];
        }
    });

    Sao.PYSON.If.eval_ = function(value, context) {
        if (value.c) {
            return value.t;
        } else {
            return value.e;
        }
    };
    Sao.PYSON.If.init_from_object = function(obj) {
        return new Sao.PYSON.If(obj.c, obj.t, obj.e);
    };

    Sao.PYSON.eval.Get = function(obj, key, default_) {
        return new Sao.PYSON.Get(obj, key, default_);
    };
    Sao.PYSON.Get = Sao.class_(Sao.PYSON.PYSON, {
        init: function(obj, key, default_=null) {
            Sao.PYSON.Get._super.init.call(this);
            if (obj instanceof Sao.PYSON.PYSON) {
                if (jQuery(obj.types()).not(['object']).length ||
                    jQuery(['object']).not(obj.types()).length) {
                    throw 'obj must be a dict';
                }
            } else {
                if (!(obj instanceof Object)) {
                    throw 'obj must be a dict';
                }
            }
            this._obj = obj;
            if (key instanceof Sao.PYSON.PYSON) {
                if (jQuery(key.types()).not(['string']).length ||
                    jQuery(['string']).not(key.types()).length) {
                    throw 'key must be a string';
                }
            } else {
                if (typeof key != 'string') {
                    throw 'key must be a string';
                }
            }
            this._key = key;
            this._default = default_;
        },
        pyson: function() {
            return {
                '__class__': 'Get',
                'v': this._obj,
                'k': this._key,
                'd': this._default
            };
        },
        types: function() {
            if (this._default instanceof Sao.PYSON.PYSON) {
                return this._default.types();
            } else {
                return [typeof this._default];
            }
        },
        __string_params__: function() {
            return [this._obj, this._key, this._default];
        }
    });

    Sao.PYSON.Get.eval_ = function(value, context) {
        if (value.k in value.v) {
            return value.v[value.k];
        } else {
            return value.d;
        }
    };
    Sao.PYSON.Get.init_from_object = function(obj) {
        return new Sao.PYSON.Get(obj.v, obj.k, obj.d);
    };

    Sao.PYSON.eval.In = function(key, obj) {
        return new Sao.PYSON.In(key, obj);
    };
    Sao.PYSON.In = Sao.class_(Sao.PYSON.PYSON, {
        init: function(key, obj) {
            Sao.PYSON.In._super.init.call(this);
            if (key instanceof Sao.PYSON.PYSON) {
                if (jQuery(key.types()).not(['string', 'number']).length) {
                    throw 'key must be a string or a number';
                }
            } else {
                if (!~['string', 'number'].indexOf(typeof key)) {
                    throw 'key must be a string or a number';
                }
            }
            if (obj instanceof Sao.PYSON.PYSON) {
                if (jQuery(obj.types()).not(['object']).length ||
                    jQuery(['object']).not(obj.types()).length) {
                    throw 'obj must be a dict or a list';
                }
            } else {
                if (!(obj instanceof Object)) {
                    throw 'obj must be a dict or a list';
                }
            }
            this._key = key;
            this._obj = obj;
        },
        pyson: function() {
            return {'__class__': 'In',
                'k': this._key,
                'v': this._obj
            };
        },
        types: function() {
            return ['boolean'];
        },
        __string_params__: function() {
            return [this._key, this._obj];
        }
    });

    Sao.PYSON.In.eval_ = function(value, context) {
        if (value.v) {
            if (value.v.indexOf) {
                return Boolean(~value.v.indexOf(value.k));
            } else {
                return !!value.v[value.k];
            }
        } else {
            return false;
        }
    };
    Sao.PYSON.In.init_from_object = function(obj) {
        return new Sao.PYSON.In(obj.k, obj.v);
    };

    Sao.PYSON.eval.Date = function(year, month, day, delta_years, delta_months,
            delta_days) {
        return new Sao.PYSON.Date(year, month, day, delta_years, delta_months,
                delta_days);
    };
    Sao.PYSON.Date = Sao.class_(Sao.PYSON.PYSON, {
        init: function(
            year=null, month=null, day=null,
            delta_years=0, delta_months=0, delta_days=0, start=null) {
            Sao.PYSON.Date._super.init.call(this);
            this._test(year, 'year');
            this._test(month, 'month');
            this._test(day, 'day');
            this._test(delta_years, 'delta_years');
            this._test(delta_days, 'delta_days');
            this._test(delta_months, 'delta_months');

            this._year = year;
            this._month = month;
            this._day = day;
            this._delta_years = delta_years;
            this._delta_months = delta_months;
            this._delta_days = delta_days;
            this._start = start;
        },
        pyson: function() {
            return {
                '__class__': 'Date',
                'y': this._year,
                'M': this._month,
                'd': this._day,
                'dy': this._delta_years,
                'dM': this._delta_months,
                'dd': this._delta_days,
                'start': this._start,
            };
        },
        types: function() {
            return ['object'];
        },
        _test: function(value, name) {
            if (value instanceof Sao.PYSON.PYSON) {
                if (jQuery(value.types()).not(
                        ['number', typeof null]).length) {
                    throw name + ' must be an integer or None';
                }
            } else {
                if ((typeof value != 'number') && (value !== null)) {
                    throw name + ' must be an integer or None';
                }
            }
        },
        __string_params__: function() {
            return [this._year, this._month, this._day, this._delta_years,
                this._delta_months, this._delta_days, this._start];
        }
    });

    Sao.PYSON.Date.eval_ = function(value, context) {
        var date = value.start;
        if (date && date.isDateTime) {
            date = Sao.Date(date.year(), date.month(), date.date());
        }
        if (!date || !date.isDate) {
            date = Sao.Date();
        }
        if (value.y) date.year(value.y);
        if (value.M) date.month(value.M - 1);
        if (value.d) date.date(value.d);
        if (value.dy) date.add(value.dy, 'y');
        if (value.dM) date.add(value.dM, 'M');
        if (value.dd) date.add(value.dd, 'd');
        return date;
    };
    Sao.PYSON.Date.init_from_object = function(obj) {
        return new Sao.PYSON.Date(
            obj.y, obj.M, obj.d, obj.dy, obj.dM, obj.dd, obj.start);
    };

    Sao.PYSON.eval.DateTime = function(year, month, day, hour, minute, second,
            microsecond, delta_years, delta_months, delta_days, delta_hours,
            delta_minutes, delta_seconds, delta_microseconds) {
        return new Sao.PYSON.DateTime(year, month, day, hour, minute, second,
            microsecond, delta_years, delta_months, delta_days, delta_hours,
            delta_minutes, delta_seconds, delta_microseconds);
    };
    Sao.PYSON.DateTime = Sao.class_(Sao.PYSON.Date, {
        init: function(
            year=null, month=null, day=null,
            hour=null, minute=null, second=null, microsecond=null,
            delta_years=0, delta_months=0, delta_days=0, 
            delta_hours=0, delta_minutes=0, delta_seconds=0,
            delta_microseconds=0, start=null) {
            Sao.PYSON.DateTime._super.init.call(this, year, month, day,
                delta_years, delta_months, delta_days, start);
            this._test(hour, 'hour');
            this._test(minute, 'minute');
            this._test(second, 'second');
            this._test(microsecond, 'microsecond');
            this._test(delta_hours, 'delta_hours');
            this._test(delta_minutes, 'delta_minutes');
            this._test(delta_seconds, 'delta_seconds');
            this._test(delta_microseconds, 'delta_microseconds');

            this._hour = hour;
            this._minute = minute;
            this._second = second;
            this._microsecond = microsecond;
            this._delta_hours = delta_hours;
            this._delta_minutes = delta_minutes;
            this._delta_seconds = delta_seconds;
            this._delta_microseconds = delta_microseconds;
        },
        pyson: function() {
            var result = Sao.PYSON.DateTime._super.pyson.call(this);
            result.__class__ = 'DateTime';
            result.h = this._hour;
            result.m = this._minute;
            result.s = this._second;
            result.ms = this._microsecond;
            result.dh = this._delta_hours;
            result.dm = this._delta_minutes;
            result.ds = this._delta_seconds;
            result.dms = this._delta_microseconds;
            return result;
        },
        __string_params__: function() {
            var date_params = Sao.PYSON.DateTime._super.__string_params__.call(
                this);
            return [date_params[0], date_params[1], date_params[2],
                this._hour, this._minute, this._second, this._microsecond,
                date_params[3], date_params[4], date_params[5],
                this._delta_hours, this._delta_minutes, this._delta_seconds,
                this._delta_microseconds, date_params[6]];
        }
    });

    Sao.PYSON.DateTime.eval_ = function(value, context) {
        var date = value.start;
        if (date && date.isDate) {
            date = Sao.DateTime.combine(date, Sao.Time());
        }
        if (!date || !date.isDateTime) {
            date = Sao.DateTime();
            date.utc();
        }
        if (value.y) date.year(value.y);
        if (value.M) date.month(value.M - 1);
        if (value.d) date.date(value.d);
        if (value.h !== null) date.hour(value.h);
        if (value.m !== null) date.minute(value.m);
        if (value.s !== null) date.second(value.s);
        if (value.ms !== null) date.milliseconds(value.ms / 1000);
        if (value.dy) date.add(value.dy, 'y');
        if (value.dM) date.add(value.dM, 'M');
        if (value.dd) date.add(value.dd, 'd');
        if (value.dh) date.add(value.dh, 'h');
        if (value.dm) date.add(value.dm, 'm');
        if (value.ds) date.add(value.ds, 's');
        if (value.dms) date.add(value.dms / 1000, 'ms');
        return date;
    };
    Sao.PYSON.DateTime.init_from_object = function(obj) {
        return new Sao.PYSON.DateTime(obj.y, obj.M, obj.d, obj.h, obj.m, obj.s,
            obj.ms, obj.dy, obj.dM, obj.dd, obj.dh, obj.dm, obj.ds, obj.dms);
    };

    Sao.PYSON.eval.TimeDelta = function(days, seconds, microseconds) {
        return new Sao.PYSON.TimeDelta(days, seconds, microseconds);
    };
    Sao.PYSON.TimeDelta = Sao.class_(Sao.PYSON.PYSON, {
        init: function(days=0, seconds=0, microseconds=0) {
            Sao.PYSON.TimeDelta._super.init.call(this);
            function test(value, name) {
                if (value instanceof Sao.PYSON.TimeDelta) {
                    if (jQuery(value.types()).not(['number']).length)
                    {
                        throw name + ' must be an integer';
                    }
                } else {
                    if (typeof value != 'number') {
                        throw name + ' must be an integer';
                    }
                }
                return value;
            }
            this._days = test(days, 'days');
            this._seconds = test(seconds, 'seconds');
            this._microseconds = test(microseconds, 'microseconds');
        },
        pyson: function() {
            return {
                '__class__': 'TimeDelta',
                'd': this._days,
                's': this._seconds,
                'm': this._microseconds,
            };
        },
        types: function() {
            return ['object'];
        },
        __string_params__: function() {
            return [this._days, this._seconds, this._microseconds];
        },
    });
    Sao.PYSON.TimeDelta.eval_ = function(value, context) {
        return Sao.TimeDelta(value.d, value.s, value.m / 1000);
    };
    Sao.PYSON.TimeDelta.init_from_object = function(obj) {
        return new Sao.PYSON.TimeDelta(obj.d, obj.s, obj.microseconds);
    };

    Sao.PYSON.eval.Len = function(value) {
        return new Sao.PYSON.Len(value);
    };
    Sao.PYSON.Len = Sao.class_(Sao.PYSON.PYSON, {
        init: function(value) {
            Sao.PYSON.Len._super.init.call(this);
            if (value instanceof Sao.PYSON.PYSON) {
                if (jQuery(value.types()).not(['object', 'string']).length ||
                    jQuery(['object', 'string']).not(value.types()).length) {
                    throw 'value must be an object or a string';
                }
            } else {
                if ((typeof value != 'object') && (typeof value != 'string')) {
                    throw 'value must be an object or a string';
                }
            }
            this._value = value;
        },
        pyson: function() {
            return {
                '__class__': 'Len',
                'v': this._value
            };
        },
        types: function() {
            return ['integer'];
        },
        __string_params__: function() {
            return [this._value];
        }
    });

    Sao.PYSON.Len.eval_ = function(value, context) {
        if (typeof value.v == 'object') {
            return Object.keys(value.v).length;
        } else {
            return value.v.length;
        }
    };
    Sao.PYSON.Len.init_from_object = function(obj) {
        return new Sao.PYSON.Len(obj.v);
    };
}());
