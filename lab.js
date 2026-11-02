(function () {
 'use strict';
 var active=null, generation=0, waitTimer=null, stopTimer=null, audioContext=null, source=null, analyser=null, meterTimer=null;
 function el(id){return document.getElementById(id);}
 var report={version:'local-meter-v3',microphonePermission:'unknown',samples:0,peakRms:0,pageURL:location.href,userAgent:navigator.userAgent,
  secureContext:typeof window.isSecureContext==='boolean'?window.isSecureContext:'unknown',
  getUserMediaAvailable:!!(navigator.mediaDevices&&navigator.mediaDevices.getUserMedia),
  capture:'not-requested',getUserMediaSucceeded:null,errorName:null,errorMessage:null,
  released:null,httpStatus:'unknown: not exposed to page',cloudflareRayId:'unknown: not exposed to page'};
 function show(message){el('report').value=JSON.stringify(report,null,2);if(message)el('status').textContent=message;}
 function stopTracks(stream){stream.getTracks().forEach(function(track){track.stop();});}
 function release(){clearInterval(meterTimer);if(source){source.disconnect();source=null;}analyser=null;if(audioContext){try{var closed=audioContext.close();if(closed&&closed.catch)closed.catch(function(){});}catch(ignore){}audioContext=null;}clearTimeout(waitTimer);clearTimeout(stopTimer);if(active){stopTracks(active);active=null;report.released=true;}el('start').disabled=false;el('stop').disabled=true;}
 function cancel(reason){generation++;release();report.capture=reason;show('已停止或取消等待。迟到的音频流会立即释放。');}
 el('start').onclick=function(event){
  if(event){event.preventDefault();event.stopPropagation();}
  if(el('start').disabled)return false;
  var current=++generation;report.capture='requesting';report.getUserMediaSucceeded=null;
  report.errorName=null;report.errorMessage=null;report.released=null;delete report.tracks;
  report.samples=0;report.peakRms=0;delete report.meterError;el('level').value=0;el('level-text').textContent='尚未采样';report.clickedAt=new Date().toISOString();report.urlAtClick=location.href;
  el('start').disabled=true;el('stop').disabled=false;show('正在申请音频流；页面不会跳转。');
  function failed(error){if(current!==generation)return;generation++;release();report.capture='failed';report.getUserMediaSucceeded=false;report.errorName=error.name||'Error';report.errorMessage=error.message||String(error);show('请求失败，请保留本页错误名称和信息。');}
  function acquired(stream){if(current!==generation){stopTracks(stream);return;}clearTimeout(waitTimer);active=stream;
   report.capture='stream-acquired';report.getUserMediaSucceeded=true;report.released=false;
   try{if(audioContext){source=audioContext.createMediaStreamSource(stream);analyser=audioContext.createAnalyser();analyser.fftSize=2048;source.connect(analyser);var bytes=new Uint8Array(analyser.fftSize);meterTimer=setInterval(function(){if(current!==generation||!analyser)return;analyser.getByteTimeDomainData(bytes);var sum=0;for(var i=0;i<bytes.length;i++){var x=(bytes[i]-128)/128;sum+=x*x;}var rms=Math.sqrt(sum/bytes.length);report.samples++;report.peakRms=Math.max(report.peakRms,rms);report.audioContextState=audioContext.state;el('level').value=rms;el('level-text').textContent='RMS '+rms.toFixed(4)+' / 峰值 '+report.peakRms.toFixed(4);show();},100);}else report.meterError='Web Audio unavailable';}catch(e){report.meterError=e.name+': '+e.message;}
   report.tracks=stream.getAudioTracks().map(function(track){return {kind:track.kind,readyState:track.readyState,muted:track.muted};});
   show('getUserMedia 成功；5 秒内自动释放。尚未验证实际人声。');
   stopTimer=setTimeout(function(){if(current!==generation)return;release();report.capture='success-released';show('音频流申请成功，全部麦克风音轨已停止。');},5000);
  }
  if(!report.getUserMediaAvailable){failed({name:'APIUnavailable',message:'navigator.mediaDevices.getUserMedia 未暴露；请结合 secureContext 判断。'});return false;}
  waitTimer=setTimeout(function(){if(current!==generation)return;generation++;release();report.capture='pending-timeout';report.errorName='PendingTimeout';report.errorMessage='15 秒无返回，不等于用户拒绝或硬件故障';show('权限请求未返回；停止测试并保留报告。');},15000);
  try{var AC=window.AudioContext||window.webkitAudioContext;if(AC){audioContext=new AC();if(audioContext.resume){var resumed=audioContext.resume();if(resumed&&resumed.catch)resumed.catch(function(e){report.meterError=e.name+': '+e.message;show();});}}}catch(e){report.meterError=e.name+': '+e.message;}
  try{navigator.mediaDevices.getUserMedia({audio:true}).then(acquired,failed);}catch(error){failed(error);}
  return false;
 };
 el('stop').onclick=function(event){if(event)event.preventDefault();cancel('cancelled');};
 window.addEventListener('pagehide',function(){cancel('page-hidden-released');});
 document.addEventListener('visibilitychange',function(){if(document.hidden)cancel('page-hidden-released');});
 if(navigator.permissions&&navigator.permissions.query){try{navigator.permissions.query({name:'microphone'}).then(function(p){report.microphonePermission=p.state;show();p.onchange=function(){report.microphonePermission=p.state;show();};},function(e){report.microphonePermission='query unsupported: '+e.name;show();});}catch(e){report.microphonePermission='query unsupported';}}
 show('v3 已就绪：secureContext = '+report.secureContext+'。尚未申请权限。');
}());
