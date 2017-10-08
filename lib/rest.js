const request = require('request');
const qs = require('querystring');
const _ = require('underscore');
const crypto = require('crypto');
const Beautifier = require('./beautifier.js');
const assert = require('assert')

class BinanceRest {

    constructor({ key, secret, recvWindow, timeout, disableBeautification }) {
        this.key = key;
        this.secret = secret;
        this.recvWindow = recvWindow;
        this.timeout = timeout || 15000;
        this.disableBeautification = disableBeautification;

        this._beautifier = new Beautifier();
        this._baseUrl = `https://www.binance.com/api/v1/`;
    }

    _makeRequest(query, callback, route, security, method) {
        assert(_.isUndefined(callback) || _.isFunction(callback), 'callback must be a function or undefined');
        assert(_.isObject(query), 'query must be an object');

        const queryString = qs.stringify(query);
        const options = {
            url: `${this._baseUrl}${route}`,
            timeout: this.timeout
        }
        if (queryString) {
            options.url += '?' + queryString;
        }
        if (security === 'SIGNED') {
            if (options.url.substr(options.url.length - 1) !== '?') {
                options.url += '&';
            }
            options.url += `signature=${this._sign(queryString)}`;
        }
        if (security === 'API-KEY' || security === 'SIGNED') {
            options.headers = {
                'X-MBX-APIKEY': this.key
            }
        }
        if (method) {
            options.method = method;
        }

        if (callback) {
            request(options, (err, response, body) => {
                let payload = JSON.parse(body);
                if (err || response.statusCode < 200 || response.statusCode > 299) {
                    callback(err || payload, payload);
                } else {
                    if (_.isArray(payload)) {
                        payload = _.map(payload, (item) => {
                            return this._doBeautifications(item, route);
                        });
                    } else {
                        payload = this._doBeautifications(payload);
                    }
                    callback(err, payload);
                }
            });
        } else {
            return new Promise((resolve, reject) => {
                request(options, (err, response, body) => {
                    if (err) {
                        reject(err);
                    } else if (response.statusCode < 200 || response.statusCode > 299) {
                        reject(JSON.parse(body));
                    } else {
                        let payload = JSON.parse(body);
                        if (_.isArray(payload)) {
                            payload = _.map(payload, (item) => {
                                return this._doBeautifications(item, route);
                            });
                        } else {
                            payload = this._doBeautifications(payload);
                        }
                        resolve(payload, route);
                    }
                });
            });
        }
    }

    _doBeautifications(response, route) {
        if (this._disableExpansions) {
            return response;
        }
        return this._beautifier.beautify(response, route);
    }

    _sign(queryString) {
        return crypto.createHash('sha256')
            .update(this.secret + '|' + queryString)
            .digest('hex');
    }

    // Public APIs
    ping(callback) {
        return this._makeRequest({}, callback, 'ping');
    }

    time(callback) {
        return this._makeRequest({}, callback, 'time');
    }

    depth(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }

        return this._makeRequest(query, callback, 'depth');
    }

    aggTrades(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }

        return this._makeRequest(query, callback, 'aggTrades');
    }

    klines(query = {}, callback) {
        return this._makeRequest(query, callback, 'klines');
    }

    ticker24hr(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }

        return this._makeRequest(query, callback, 'ticker/24hr');
    }

    allPrices(query = {}, callback) {
      if (_.isString(query)) {
          query = {
              symbol: query
          }
      }
      return this._makeRequest(query, callback, 'ticker/allPrices');
    }

    allBookTickers(query = {}, callback) {
      if (_.isString(query)) {
          query = {
              symbol: query
          }
      }
      return this._makeRequest(query, callback, 'ticker/allBookTickers');
    }

    // Private APIs
    newOrder(query = {}, callback) {
        return this._makeRequest(query, callback, 'order', 'SIGNED', 'POST');
    }

    testOrder(query = {}, callback) {
        return this._makeRequest(query, callback, 'order/test', 'SIGNED', 'POST');
    }

    queryOrder(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'order', 'SIGNED');
    }

    cancelOrder(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'order', 'SIGNED', 'DELETE');
    }

    openOrders(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'openOrders', 'SIGNED');
    }

    allOrders(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'allOrders', 'SIGNED');
    }

    account(query = {}, callback) {
        if (_.isFunction(query)) {
            callback = query;
            query = {
                timestamp: new Date().getTime()
            }
        } else if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'account', 'SIGNED');
    }

    myTrades(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }
        if (!query.timestamp) {
            query.timestamp = new Date().getTime();
        }

        return this._makeRequest(query, callback, 'myTrades', 'SIGNED');
    }

    startUserDataStream(callback) {
        return this._makeRequest({}, callback, 'userDataStream', 'API-KEY', 'POST');
    }

    keepAliveUserDataStream(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }

        return this._makeRequest(query, callback, 'userDataStream', 'API-KEY', 'PUT');
    }

    closeUserDataStream(query = {}, callback) {
        if (_.isString(query)) {
            query = {
                symbol: query
            }
        }

        return this._makeRequest(query, callback, 'userDataStream', 'API-KEY', 'DELETE');
    }
}

module.exports = BinanceRest;
