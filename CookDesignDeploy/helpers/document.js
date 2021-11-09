exports.addSuffix = (fileName, suffix) => {
    var fileExt = fileName.split('.').pop();
    var fileName = fileName.substr(0, fileName.lastIndexOf('.'));
    var newName = fileName + "." + suffix + "." + fileExt;

    return newName;
  }

  exports.baseName = (str) => {
     var base = new String(str).substring(str.lastIndexOf('/') + 1);
      //if(base.lastIndexOf(".") != -1)
      //    base = base.substring(0, base.lastIndexOf("."));
     return base;
  }

  exports.baseUrl = (str) => {
     var base = new String(str).substring(0,str.lastIndexOf('/'));
      //if(base.lastIndexOf(".") != -1)
      //    base = base.substring(0, base.lastIndexOf("."));
     return base;
  }