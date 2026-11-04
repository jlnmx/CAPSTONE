// Injected into the Leaflet WebViews. Saves every map tile that is viewed (and a small area
// around evacuation centers) in IndexedDB so the map keeps rendering without a connection.
export const OFFLINE_TILE_SCRIPT = `
(function () {
  var DB_NAME = 'handa-tiles';
  var STORE = 'tiles';
  var MAX_TILES = 4000;
  var dbPromise = null;
  var writes = 0;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve) {
      try {
        var request = indexedDB.open(DB_NAME, 1);
        request.onupgradeneeded = function () {
          var store = request.result.createObjectStore(STORE, { keyPath: 'key' });
          store.createIndex('savedAt', 'savedAt');
        };
        request.onsuccess = function () { resolve(request.result); };
        request.onerror = function () { resolve(null); };
      } catch (error) { resolve(null); }
    });
    return dbPromise;
  }

  function readTile(key) {
    return openDb().then(function (db) {
      if (!db) return null;
      return new Promise(function (resolve) {
        try {
          var request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
          request.onsuccess = function () { resolve(request.result || null); };
          request.onerror = function () { resolve(null); };
        } catch (error) { resolve(null); }
      });
    });
  }

  function hasTile(key) {
    return openDb().then(function (db) {
      if (!db) return false;
      return new Promise(function (resolve) {
        try {
          var request = db.transaction(STORE, 'readonly').objectStore(STORE).getKey(key);
          request.onsuccess = function () { resolve(request.result !== undefined); };
          request.onerror = function () { resolve(false); };
        } catch (error) { resolve(false); }
      });
    });
  }

  function trimTiles(db) {
    try {
      var store = db.transaction(STORE, 'readwrite').objectStore(STORE);
      var countRequest = store.count();
      countRequest.onsuccess = function () {
        var excess = countRequest.result - MAX_TILES;
        if (excess <= 0) return;
        var cursorRequest = store.index('savedAt').openCursor();
        cursorRequest.onsuccess = function () {
          var cursor = cursorRequest.result;
          if (!cursor || excess <= 0) return;
          cursor.delete();
          excess -= 1;
          cursor.continue();
        };
      };
    } catch (error) {}
  }

  function writeTile(key, blob) {
    return openDb().then(function (db) {
      if (!db) return;
      try {
        db.transaction(STORE, 'readwrite').objectStore(STORE).put({ key: key, blob: blob, savedAt: Date.now() });
        writes += 1;
        if (writes % 100 === 0) trimTiles(db);
      } catch (error) {}
    });
  }

  function cacheKey(url) {
    return url.replace(/([?&])access_token=[^&]*&?/, '$1').replace(/[?&]$/, '');
  }

  function downloadTile(url, key) {
    return fetch(url).then(function (response) {
      if (!response.ok) throw new Error('tile ' + response.status);
      return response.blob();
    }).then(function (blob) {
      return writeTile(key, blob).then(function () { return blob; });
    });
  }

  function loadTile(url) {
    var key = cacheKey(url);
    return readTile(key).then(function (record) {
      if (record && record.blob) return record.blob;
      return downloadTile(url, key);
    });
  }

  window.createCachedTileLayer = function (urlTemplate, options) {
    var CachedTileLayer = L.TileLayer.extend({
      createTile: function (coords, done) {
        var tile = document.createElement('img');
        tile.alt = '';
        tile.setAttribute('role', 'presentation');
        loadTile(this.getTileUrl(coords)).then(function (blob) {
          var objectUrl = URL.createObjectURL(blob);
          tile.onload = function () { URL.revokeObjectURL(objectUrl); done(null, tile); };
          tile.onerror = function () { URL.revokeObjectURL(objectUrl); done(null, tile); };
          tile.src = objectUrl;
        }).catch(function (error) {
          // Offline gaps stay as empty tiles instead of triggering a provider fallback.
          done(navigator.onLine === false ? null : error, tile);
        });
        return tile;
      },
      // Quietly saves tiles around the given [lat, lng] points for later offline use.
      prefetchAround: function (points, zooms, radius, limit) {
        var layer = this;
        if (!layer._map || navigator.onLine === false) return;
        var queue = [];
        var seen = {};
        var size = layer.getTileSize();
        zooms.forEach(function (zoom) {
          points.forEach(function (point) {
            var tilePoint = layer._map.project(L.latLng(point[0], point[1]), zoom).unscaleBy(size).floor();
            for (var dx = -radius; dx <= radius; dx += 1) {
              for (var dy = -radius; dy <= radius; dy += 1) {
                var coords = { x: tilePoint.x + dx, y: tilePoint.y + dy, z: zoom };
                var url = layer.getTileUrl(coords);
                if (!seen[url] && queue.length < limit) { seen[url] = true; queue.push(url); }
              }
            }
          });
        });
        var next = function () {
          var url = queue.shift();
          if (!url) return;
          var key = cacheKey(url);
          hasTile(key).then(function (exists) {
            return exists ? null : downloadTile(url, key);
          }).catch(function () {}).then(next);
        };
        next(); next(); next();
      }
    });
    return new CachedTileLayer(urlTemplate, options);
  };
})();
`;
