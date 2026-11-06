// Testing-only storage namespace adapter.
// Keep the application bundle unchanged while separating browser-local session/config keys.
(function isolateTestingStorage(){
  'use strict';
  const local = window.localStorage;
  const nativeGet = Storage.prototype.getItem;
  const nativeSet = Storage.prototype.setItem;
  const nativeRemove = Storage.prototype.removeItem;
  const mapKey = key => key === 'psb_session' ? 'psb_session_testing' :
    key === 'psb_public_config' ? 'psb_public_config_testing' : key;
  Storage.prototype.getItem = function(key){
    return nativeGet.call(this, this === local ? mapKey(String(key)) : key);
  };
  Storage.prototype.setItem = function(key,value){
    return nativeSet.call(this, this === local ? mapKey(String(key)) : key, value);
  };
  Storage.prototype.removeItem = function(key){
    return nativeRemove.call(this, this === local ? mapKey(String(key)) : key);
  };
})();
