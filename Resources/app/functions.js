function spinIcon(icon,t){/*var icon = $('#search-btn-icon');*/ if(t){icon .removeClass('glyphicon-search') .addClass('glyphicon-refresh') .addClass('spin'); }else{icon .removeClass('spin') .removeClass('glyphicon-refresh') .addClass('glyphicon-search'); } } 

function loadFile(titFile){
    var fileContent = "";
    var fileStream = Ti.Filesystem.getFileStream(titFile);
    if (fileStream.open(Ti.Filesystem.MODE_READ))
    {
        fileContent = fileStream.read(titFile.size());
        fileStream.close();
    }
    return String(fileContent);
}
function log2(x){return Math.log(x)/Math.log(2);}
function parseArff(baseName){
  var resourcesDir = Ti.Filesystem.getResourcesDirectory();
  var dir = Ti.Filesystem.getFile(resourcesDir+"\\data\\");
  // convert arff file and save as json
  arff(dir.toString()+"\\"+baseName+'.arff','-json');
  var contents;      
      file= Ti.Filesystem.getFile(dir, baseName+'.json');      
  contents = loadFile(file);
  window.data = jQuery.parseJSON(contents);
}
function populateDB(db,baseName,contents){
  var q1 = 'ID INTEGER AUTO_INCREMENT, ',q2 = 'id,',q3 = '';
  for(i in data.attributes){
    if(i!=data.attributes.length-1){
      q1 += data.attributes[i].name+' TEXT, ';
      q2 += data.attributes[i].name+',';
      q3 += '?,';
    }else{
      q1 += data.attributes[i].name+' TEXT';
      q2 += data.attributes[i].name;
      q3 += '?';
    }
  }
  var query = ("DROP TABLE IF EXISTS "+baseName);
  db.execute(query);
  var query = ("CREATE TABLE IF NOT EXISTS "+baseName+" ("+q1+")");
  console.log('db table '+baseName+' created.');
  db.execute(query);
  for(i in data.data){
      j = i-(-1);
      var k=j+',';
    for(j in data.attributes){
      if(j!=data.attributes.length-1){
        k+='\''+data.data[i][data.attributes[j].name]+'\',';
      }else{
        k+='\''+data.data[i][data.attributes[j].name]+'\'';
      }
    }
    query = "INSERT INTO "+baseName+" ("+q2+") VALUES ("+k+")";
    db.execute(query);
  }
  console.log('db table '+baseName+' populated.');
}
function getUnique(baseName,v){
  q = "SELECT DISTINCT "+v+" FROM "+baseName;
  var rows = db.execute(q),
      ans = [];
  while (rows.isValidRow()) {
      // push sql's answer to array
      ans.push(rows.fieldByName(v));
      rows.next();
  }
  return ans;
}
function getSetSize(baseName){
  var q = "SELECT COUNT(*) AS c FROM "+baseName;
  rows = db.execute(q);
  while(rows.isValidRow()){
    count = rows.fieldByName('c');
    rows.next(); 
  }
  rows.close();
  return count;
}
function countSubset(baseName,attribute,value,v){
  q = "SELECT COUNT(*) as count FROM "+baseName+" WHERE "+attribute+"=\'"+value+"\'";
  if(typeof v!='undefined'){
    extraSQL = '';
    for(i in v){
      extraSQL+= " AND "+v[i].attribute+"=\'"+v[i].value+"\'";
    }
    // console.log('------ countSubset::hasExtras '+Object.keys(v).length);
    // if(Object.keys(v).length==1){
    //  var extras = v;
    //  // extraSQL+= extras[0].attribute+"=\'"+extras[0].value+"\'";
    // }else{
    // }
    q+=extraSQL;
  }
  // console.log('------ countSubset::query '+q);
  rows = db.execute(q);
  while(rows.isValidRow()){
    count = rows.fieldByName('count');
    rows.next(); 
  }
  // console.log('------ countSubset::answer '+count);
  rows.close();
  // console.log(value+' '+count);
  return Number(count);
}
function getSv(baseName,targetClass,attribute,attributeVal,v){
  var uniq = getUnique(baseName,targetClass),
      count = [],
      extraSQL = '';


  console.log('----- getSv fired!')
  if(typeof v!='undefined'){
    console.log(v.length);
    for(i in v){
      extraSQL = " AND "+v[i].attribute+" = \'"+v[i].value+"\'";
    }
    console.log("Sv has extra :"+extraSQL);
  }
  for(i in uniq){
    var q = "SELECT COUNT(*) as count FROM "+baseName+" WHERE "+attribute+"=\'"+attributeVal+"\' AND "+targetClass+"=\'"+uniq[i]+"\' "+extraSQL;
    // $('#message').append('executing</br> <strong> '+q+'</strong></br>');
    var rows = db.execute(q);
    while(rows.isValidRow()){
      count.push(Number(rows.fieldByName('count')));
      rows.next(); 
    }
    rows.close();
    // $('#message').append('answer</br> <strong> '+count+'</strong></br>');
  }
  // $('#message').append('S('+attribute+'='+attributeVal+') is '+count+'<br>');
  console.log('S('+attribute+'='+attributeVal+') is ');
  console.log(count);
  return count;
}
function entropyX(baseName,attribute,extras){
  /*
  "SELECT
      play,
      100 * count(*) / (SELECT count(*) FROM weather WHERE outlook= 'sunny') AS float 
    FROM weather
    WHERE outlook = 'sunny'
    GROUP BY play
    "
  */
  var probs = [],
      extraSQL=''
  if(Object.keys(extras).length==1){
    extraSQL+= extras[0].attribute+"=\'"+extras[0].value+"\'";
  }else{
    for(i in extras){
      if(i==0){
        extraSQL+= extras[i].attribute+"=\'"+extras[i].value+"\' ";
      }else{
        extraSQL+= " AND "+extras[i].attribute+"=\'"+extras[i].value+"\'";
      }
    }
  }
  q = "SELECT "+attribute+","+
        "100 * count(*) / (SELECT count(*) FROM "+baseName+" WHERE "+extraSQL+") AS score "+ 
        "FROM weather "+
        "WHERE "+extraSQL+" "+
        "GROUP BY play";
  rows = db.execute(q);
  while(rows.isValidRow()){
    probs.push(Number(rows.fieldByName('score'))/100);
    rows.next();
  }
  rows.close();
  // entropy formula parts
  var logVals = probs.map(function(x){
    if(x==1){
        return 1;
    }
    if(x==0){
      console.log('! x is 0');
      return 0;
    }
    return -x*log2(x) 
  }); 
  // sum all parts and return entropy value
  z = logVals.reduce(function(a,b){return a+b},0); 
  console.log('\n------- got Entropy '+z+'\n');
  return z
}
function entropy(baseName,attribute){
  // we want to get entropy by attribute name.  
  // let's use a neat sql statement to get the percentage of the distinct attribute values
  var q = "SELECT CAST(COUNT("+attribute+") AS float) / CAST(t.Total AS float) AS percentage "+
          "FROM weather, "+
               "(SELECT COUNT(*) As Total FROM "+baseName+") t "+
          "GROUP BY "+attribute+", Total",
      probs = [];
    console.log(q);
  // execute the awesomeness
  var rows = db.execute(q);
  while (rows.isValidRow()) {
      // push sql's answer to array
      probs.push(Number(rows.fieldByName('percentage')));
      rows.next();
  }
  // release memory once we are done with the resultset and the database
  rows.close();
  // entropy formula parts
  var logVals = probs.map(function(x){
    if(x==1){
        return 1;
    }
    if(x==0){
      console.log('! x is 0');
      return 0;
    }
    return -x*log2(x) 
  }); 
  // sum all parts and return entropy value
  return logVals.reduce(function(a,b){return a+b},0); 
}
function entropyS(probs){

  var sum = _.reduce(probs,function(a,b){return a+b},0);
  var logVals = probs.map(function(p){
    x = p/sum;
    
    y = -x*log2(x);
    console.log('\nentropyS:: -('+p+'/'+sum+') * log2('+p+'/'+sum+') = '+y+' (x='+x+')  \n \n\n');
    return y;
  });
  return logVals.reduce(function(a,b){return a+b},0); 
}
function entropyNum(nums,sum){
  /* 
   *        
   * NOTE:  this method does not map probabilities to log2,
   *        it implements the simple method of getting the entropy of an array. 
   *        
   *        eg Entropy[3+,3] = 1
   *        
   */   

  // use the sum of the array if undefined
  if(typeof sum==='undefined'){
    sum = _.reduce(nums, function(a, b){ return a + b; }, 0),
  }else{
    sum = _.reduce(sum, function(a, b){ return a + b; }, 0),
  }

  if(nums[0]==nums[1] || (nums[0]==nums[1] && nums[1]==nums[2]) ){
    console.log('entropy is 1');
    return 1;
  }
  // entropy formula parts
  var logVals = nums.map(function(p){
      x = (p/sum);
      if(x==0){
        y = 0;
      }else{
        y = -(x)*log2(x);
      }
      console.log('\n -('+p+'/'+sum+') * log2('+p+'/'+sum+') = '+y+' (x='+x+')  \n \n\n');
      return y; 
  }); 
  // sum all parts and return entropy value
  var ent = logVals.reduce(function(a,b){return a+b},0); 
  console.log('entropy of ['+nums+','+sum+'] ='+ent);
  return ent;
}
function getMaxInfoGain(baseName,data,targetClass,v){
  for(i in data.attributes){
    if(typeof v!=='undefined'){
      var gain = informationGain(baseName,targetClass,data.attributes[i].name,v);
    }else{
      var gain = informationGain(baseName,targetClass,data.attributes[i].name);
    }
    if(gain.attribute!=targetClass){
      infoGains.push(gain);
    }
  }
  var k = _.pluck(infoGains, 'infoGain');
  var m = _.max(infoGains,function(infoGain){return infoGain.infoGain});
  return m;
}
function informationGain(baseName,targetClass,attribute){
  var attrVals = getUnique(baseName,attribute),
      setEntropy = entropy(baseName,targetClass),
      // setSize = Number(getSetSize(baseName)),
      subsets = [],
      entropies = [],
      Sv = {};
  // get subsets
  var infoGain=entropy(baseName,targetClass);
  for(i in attrVals){
    subsets.push(countSubset(baseName,attribute,attrVals[i]));  
    Sv[i] = getSv(baseName,targetClass,attribute,attrVals[i]);
  }
  // calculate entropies of subsets
  for(i in Sv){
    var s = Sv[i];
    entropies.push(entropyNum(s));
  }
  // finally, calculate information gain
  // var infoGain=setEntropy;
  var setSize = _.reduce(subsets, function(memo, num){ return memo + num; }, 0);
  for(i in attrVals){
    infoGain -= Number(subsets[i]/setSize) * Number(entropies[i]);
  }
  return infoGain;
}
function LOG(msg){console.log(msg);$('#message').append(msg+'<br>');}

function gain(baseName,targetClass,attribute,v){
  var attrVals = getUnique(baseName,attribute),
      targetVals = getUnique(baseName,targetClass),
      S = [], Sv = [], P = [], T = [],
      entropies = [];
  $('#message').empty();

  for(i in targetVals){S.push(countSubset(baseName,targetClass,targetVals[i],v));}
  var infoGain = entropyNum(S);

  for(i in attrVals){P.push(countSubset(baseName,attribute,attrVals[i],v)); } 
  for(i in attrVals){T.push(countSubset(baseName,attribute,attrVals[i])); } 
  for(i in attrVals){
    // subsets.push(countSubset(baseName,attribute,attrVals[i]));  
    Sv[i] = getSv(baseName,targetClass,attribute,attrVals[i],v);
  }
  for(i in v){
    LOG('gain('+baseName+','+targetClass+','+attribute+',v) called');
    LOG('has parent node '+v[i].attribute+'='+v[i].value);
  }
  // if(v.length==1){
  //  sUnderV = countSubset(baseName,v[0].attribute,v[0].value);
  // }
  
  // calculate entropies of subsets
  for(i in Sv){
    var s = Sv[i];
    entropies.push(entropyNum(s));
  }
  var sum = _.reduce(P, function(memo, num){ return memo + num; }, 0);
  for(i in entropies){
    infoGain -= (P[i]/sum)*entropies[i];
  }
  console.log('\n\n GAIN = '+infoGain+'\n\n');
  return {attribute:attribute,infoGain:infoGain};
}
function maxGain(baseName,data,targetClass,v){
  var infoGains = [];
  for(i in data.attributes){
    if(data.attributes[i].name!=targetClass){
      console.log('will check for '+data.attributes[i].name);
      thisGain = gain(baseName,targetClass,data.attributes[i].name,v);
      infoGains.push(thisGain);
    }
  }
  var k = _.pluck(infoGains, 'infoGain');
  var m = _.max(infoGains,function(infoGain){return infoGain.infoGain});
  return m;
}