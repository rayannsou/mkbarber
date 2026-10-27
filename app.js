(function(){
"use strict";
var C=window.MK_CONFIG,API=C.url,KEY=C.key;
var $app=document.getElementById('app'),$tabs=document.getElementById('tabs'),$toast=document.getElementById('toast');
var DAYS=['dimanche','lundi','mardi','mercredi','jeudi','vendredi','samedi'];
var DAYS_S=['dim','lun','mar','mer','jeu','ven','sam'];
var MONTHS=['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
var MONTHS_S=['janv.','févr.','mars','avr.','mai','juin','juil.','août','sept.','oct.','nov.','déc.'];
var ORDER=[1,2,3,4,5,6,0];
var STATUS={pending:'En attente',confirmed:'Confirmé',declined:'Refusé',cancelled:'Annulé'};
var LS_TOK='mk-barber-tokens',LS_FORM='mk-barber-form',SS_CODE='mk-barber-code';

function clone(o){return JSON.parse(JSON.stringify(o));}
function pad(n){return (n<10?'0':'')+n;}
function dk(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function parseKey(k){var p=k.split('-');return new Date(+p[0],+p[1]-1,+p[2]);}
function toMin(t){var p=String(t).split(':');return (+p[0])*60+(+p[1]);}
function fromMin(m){return pad(Math.floor(m/60))+':'+pad(m%60);}
function longDate(k){var d=parseKey(k);return DAYS[d.getDay()]+' '+d.getDate()+' '+MONTHS[d.getMonth()];}
function euro(n){return (Math.round(n*100)/100).toString().replace('.',',')+' €';}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function rid(){return Math.random().toString(36).slice(2,8);}
function today(){return dk(new Date());}

function rpc(fn,args){
  return fetch(API+'/rest/v1/rpc/'+fn,{method:'POST',headers:{'apikey':KEY,'Authorization':'Bearer '+KEY,'Content-Type':'application/json'},body:JSON.stringify(args||{})})
    .then(function(r){if(!r.ok)throw new Error('http '+r.status);return r.json();});
}

var S={
  view:'book',admView:'req',
  cfg:null,busy:[],loaded:false,loadErr:false,
  sel:{svc:null,date:null,time:null},form:{name:'',phone:''},err:null,sending:false,
  mine:[],justSent:false,confirm:null,
  code:null,admin:false,adminErr:null,adm:[],admAt:null,loggingIn:false,
  draft:null,dirty:false,settingsErr:null,saving:false,
  nb:{date:'',time:'10:00',svc:'',name:'',phone:''},nbErr:null
};
try{var sv=JSON.parse(localStorage.getItem(LS_FORM)||'null');if(sv){S.form.name=sv.name||'';S.form.phone=sv.phone||'';}}catch(e){}
try{S.code=sessionStorage.getItem(SS_CODE);}catch(e){}
function tokens(){try{return JSON.parse(localStorage.getItem(LS_TOK)||'[]');}catch(e){return [];}}
function addToken(t){var a=tokens();a.unshift(t);try{localStorage.setItem(LS_TOK,JSON.stringify(a.slice(0,20)));}catch(e){}}

function normalize(c){
  c.services=c.services||[];c.closed=c.closed||[];c.hours=c.hours||{};c.horizonDays=c.horizonDays||21;
  for(var i=0;i<7;i++){var h=c.hours[i]||(c.hours[i]={open:false});if(!h.ranges||!h.ranges.length)h.ranges=[{s:'09:00',e:'19:00'}];}
  return c;
}

/* ---------- disponibilités ---------- */
function slotKey(date,min){return date+'_'+min;}
function busySet(){var s={};S.busy.forEach(function(b){var st=toMin(b.time);for(var m=st;m<st+b.dur;m+=15)s[slotKey(b.date,m)]=1;});return s;}
function avail(date,dur){
  var c=S.cfg;if(!c)return [];
  var h=c.hours[parseKey(date).getDay()];
  if(!h||!h.open||c.closed.indexOf(date)>-1)return [];
  var bs=busySet(),out=[],now=new Date(),isToday=date===today(),lead=now.getHours()*60+now.getMinutes()+30;
  h.ranges.forEach(function(r){
    var st=toMin(r.s),en=toMin(r.e);
    for(var t=st;t+dur<=en;t+=30){
      if(isToday&&t<lead)continue;
      var ok=true;
      for(var b=t;b<t+dur;b+=15){if(bs[slotKey(date,b)]){ok=false;break;}}
      if(ok)out.push(fromMin(t));
    }
  });
  out.sort();return out;
}
function svcById(id){var c=S.cfg;if(!c)return null;for(var i=0;i<c.services.length;i++){if(c.services[i].id===id)return c.services[i];}return null;}
function nextDays(){var a=[],d=new Date(),n=S.cfg?S.cfg.horizonDays:21;for(var i=0;i<n;i++){a.push(dk(d));d=new Date(d.getFullYear(),d.getMonth(),d.getDate()+1);}return a;}

/* ---------- chargement ---------- */
function loadPublic(){
  var from=today(),to=dk(new Date(Date.now()+60*86400000));
  return Promise.all([rpc('mk_get_config'),rpc('mk_busy',{p_from:from,p_to:to})]).then(function(r){
    S.cfg=normalize(r[0]);S.busy=r[1]||[];S.loaded=true;S.loadErr=false;
    if(!S.dirty)S.draft=clone(S.cfg);
  },function(){S.loadErr=true;S.loaded=true;});
}
function loadMine(){
  var t=tokens();if(!t.length){S.mine=[];return Promise.resolve();}
  return rpc('mk_my_bookings',{p_tokens:t}).then(function(r){S.mine=r||[];},function(){});
}
function loadAdmin(){
  if(!S.code)return Promise.resolve();
  return rpc('mk_admin_list',{p_code:S.code}).then(function(r){
    if(r.ok){S.adm=r.bookings||[];S.admin=true;var n=new Date();S.admAt=pad(n.getHours())+':'+pad(n.getMinutes());}
    else{logout(true);}
  },function(){});
}
function logout(silent){S.admin=false;S.code=null;S.adm=[];try{sessionStorage.removeItem(SS_CODE);}catch(e){}if(!silent)render();else render();}

/* ---------- rendu ---------- */
function pendingCount(){return S.adm.filter(function(b){return b.status==='pending';}).length;}
function renderTabs(){
  var t=[['book','Réserver'],['mine','Mes rendez-vous'],['admin',S.admin?'Gérant'+(pendingCount()?' ('+pendingCount()+')':''):'Connexion']];
  $tabs.innerHTML=t.map(function(x){return '<button role="tab" type="button" data-act="tab" data-v="'+x[0]+'" aria-selected="'+(S.view===x[0])+'">'+x[1]+'</button>';}).join('');
}
function render(){
  renderTabs();
  var h;
  if(!S.loaded)h='<div class="empty">Chargement…</div>';
  else if(S.view==='admin')h=S.admin?vAdmin():vLogin();
  else if(S.view==='mine')h=vMine();
  else h=vBook();
  $app.innerHTML=h;
}
var pendingRender=false;
function softRender(){
  var a=document.activeElement;
  if(a&&$app.contains(a)&&(a.tagName==='INPUT'||a.tagName==='SELECT'||a.tagName==='TEXTAREA')){pendingRender=true;return;}
  render();
}
document.addEventListener('focusout',function(){if(pendingRender){setTimeout(function(){var a=document.activeElement;if(!(a&&$app.contains(a)&&(a.tagName==='INPUT'||a.tagName==='SELECT'))){pendingRender=false;render();}},60);}});

function vBook(){
  if(S.loadErr&&!S.cfg)return '<div class="empty"><strong>Connexion impossible</strong>Vérifiez votre connexion internet.<div style="margin-top:12px"><button type="button" class="btn small" data-act="reload">Réessayer</button></div></div>';
  var c=S.cfg;
  if(!c.services.length)return '<div class="empty"><strong>Pas de prestation pour le moment</strong>Revenez un peu plus tard.</div>';
  if(!S.sel.svc||!svcById(S.sel.svc))S.sel.svc=c.services[0].id;
  var svc=svcById(S.sel.svc),h='';
  h+='<section><h3 style="margin-top:0">Prestation</h3><div class="svc" role="radiogroup" aria-label="Prestation">';
  c.services.forEach(function(s){h+='<label><input type="radio" name="svc" data-bind="svc" value="'+esc(s.id)+'"'+(s.id===S.sel.svc?' checked':'')+'><span class="n">'+esc(s.name)+'<span class="d">'+s.dur+' min</span></span><span class="p">'+euro(s.price)+'</span></label>';});
  h+='</div></section>';
  var anyDay=false;
  h+='<section><h3>Jour</h3><div class="days">';
  nextDays().forEach(function(d){
    var n=avail(d,svc.dur).length,dt=parseKey(d);if(n)anyDay=true;
    h+='<button type="button" class="day" data-act="day" data-d="'+d+'" aria-pressed="'+(S.sel.date===d)+'"'+(n?'':' disabled')+' aria-label="'+esc(longDate(d))+(n?'':', complet ou fermé')+'"><span class="w">'+DAYS_S[dt.getDay()]+'</span><span class="k">'+dt.getDate()+'</span><span class="m">'+MONTHS_S[dt.getMonth()]+'</span></button>';
  });
  h+='</div>';
  if(!anyDay)h+='<p class="note" style="margin-top:10px">Aucun créneau libre dans les '+c.horizonDays+' prochains jours.</p>';
  h+='</section>';
  if(S.sel.date){
    var ts=avail(S.sel.date,svc.dur);
    if(S.sel.time&&ts.indexOf(S.sel.time)<0)S.sel.time=null;
    h+='<section><h3>Heure, '+esc(longDate(S.sel.date))+'</h3>';
    if(!ts.length)h+='<div class="empty"><strong>Journée complète</strong>Choisissez un autre jour.</div>';
    else{h+='<div class="times">';ts.forEach(function(t){h+='<button type="button" class="time" data-act="time" data-t="'+t+'" aria-pressed="'+(S.sel.time===t)+'">'+t+'</button>';});h+='</div>';}
    h+='</section>';
  }
  if(S.sel.date&&S.sel.time){
    h+='<section><h3>Vos coordonnées</h3><div class="card">';
    h+='<div class="summary"><span><b>'+esc(svc.name)+'</b></span><span>'+esc(longDate(S.sel.date))+', '+S.sel.time+' à '+fromMin(toMin(S.sel.time)+svc.dur)+'</span><span>'+euro(svc.price)+'</span></div>';
    h+='<div class="field"><label for="fName">Nom et prénom</label><input type="text" id="fName" data-bind="name" autocomplete="name" value="'+esc(S.form.name)+'"></div>';
    h+='<div class="field"><label for="fPhone">Téléphone</label><input type="tel" id="fPhone" data-bind="phone" autocomplete="tel" inputmode="tel" value="'+esc(S.form.phone)+'"></div>';
    if(S.err)h+='<p class="err">'+esc(S.err)+'</p>';
    h+='<button type="button" class="btn" data-act="request"'+(S.sending?' disabled':'')+'>'+(S.sending?'Envoi…':'Envoyer ma demande')+'</button>';
    h+='<p class="note" style="margin:12px 0 0">Le rendez-vous est confirmé quand MK Barber valide votre demande. Vous verrez la réponse dans « Mes rendez-vous ».</p>';
    h+='</div></section>';
  }
  return h;
}

function statusBadge(s){return '<span class="badge st-'+s+'">'+STATUS[s]+'</span>';}
function vMine(){
  var h='<h2>Mes rendez-vous</h2>';
  if(S.justSent)h+='<div class="banner">Demande envoyée. Elle est en attente de confirmation par MK Barber. Revenez sur cette page pour voir la réponse.</div>';
  var list=S.mine.filter(function(b){return b.date>=today();}).sort(function(a,b){return (a.date+a.time)<(b.date+b.time)?-1:1;});
  if(!list.length)return h+'<div class="empty"><strong>Aucun rendez-vous à venir</strong>Réservez un créneau depuis l’onglet Réserver. Vos demandes sont retrouvées sur cet appareil.</div>';
  list.forEach(function(b){
    var conf=S.confirm===b.token,active=(b.status==='pending'||b.status==='confirmed');
    h+='<div class="row"><div class="t">'+b.time+'<br><span class="sub">'+fromMin(toMin(b.time)+b.dur)+'</span></div><div class="who"><b>'+esc(b.service)+'</b><span>'+esc(longDate(b.date))+' · '+euro(b.price)+'</span><span style="margin-top:6px">'+statusBadge(b.status)+'</span></div>';
    if(active){
      h+='<div class="acts">'+(conf?'<button type="button" class="btn small danger" data-act="cancel-yes" data-t="'+b.token+'">Confirmer l’annulation</button><button type="button" class="btn small ghost" data-act="cancel-no">Garder</button>':'<button type="button" class="btn small ghost" data-act="cancel" data-t="'+b.token+'">Annuler</button>')+'</div>';
    }
    h+='</div>';
  });
  return h;
}

/* ---------- gérant ---------- */
function vLogin(){
  var h='<h2>Connexion gérant</h2><div class="card"><p class="note">Réservé à MK Barber. Entrez votre code pour confirmer les demandes et régler les horaires.</p>';
  h+='<div class="field"><label for="code">Code</label><input type="password" id="code" autocomplete="current-password"></div>';
  if(S.adminErr)h+='<p class="err">'+esc(S.adminErr)+'</p>';
  h+='<button type="button" class="btn" data-act="login"'+(S.loggingIn?' disabled':'')+'>'+(S.loggingIn?'Connexion…':'Se connecter')+'</button></div>';
  return h;
}
function vAdmin(){
  var n=pendingCount();
  var h='<div class="admbar"><span class="note" style="margin:0">'+(S.admAt?'Mis à jour à '+S.admAt:'')+'</span><span><button type="button" class="btn small ghost" data-act="refresh">Actualiser</button> <button type="button" class="btn small ghost" data-act="logout">Se déconnecter</button></span></div>';
  h+='<nav class="tabs" style="margin-top:0">';
  [['req','Demandes'+(n?' ('+n+')':'')],['agenda','Agenda'],['set','Réglages']].forEach(function(x){h+='<button type="button" data-act="adm" data-v="'+x[0]+'" aria-selected="'+(S.admView===x[0])+'">'+x[1]+'</button>';});
  h+='</nav>';
  if(S.admView==='agenda')return h+vAgenda();
  if(S.admView==='set')return h+vSettings();
  return h+vRequests();
}
function admRow(b,actions){
  return '<div class="row"><div class="t">'+b.time+'<br><span class="sub">'+fromMin(toMin(b.time)+b.dur)+'</span></div><div class="who"><b>'+esc(b.name)+'</b><span>'+esc(b.service)+' · '+euro(b.price)+'</span><span>'+(b.phone?'<a href="tel:'+esc(b.phone.replace(/[^\d+]/g,''))+'">'+esc(b.phone)+'</a>':'')+'</span></div><div class="acts">'+actions+'</div></div>';
}
function vRequests(){
  var list=S.adm.filter(function(b){return b.status==='pending'&&b.date>=today();});
  var h='<h2>Demandes à confirmer</h2>';
  if(!list.length)return h+'<div class="empty"><strong>Aucune demande en attente</strong>Les nouvelles demandes de vos clients apparaissent ici.</div>';
  var cur=null;
  list.forEach(function(b){
    if(cur!==b.date){cur=b.date;h+='<p class="day-h">'+esc(longDate(cur))+'</p>';}
    h+=admRow(b,'<button type="button" class="btn small" data-act="st" data-id="'+b.id+'" data-s="confirmed">Confirmer</button><button type="button" class="btn small ghost" data-act="st" data-id="'+b.id+'" data-s="declined">Refuser</button>');
  });
  return h;
}
function vAgenda(){
  if(!S.cfg)return '<div class="empty">Chargement impossible. Actualisez la page.</div>';
  var c=S.cfg,h='<h2>Agenda</h2>';
  h+='<div class="card"><h3 style="margin-top:0">Ajouter un rendez-vous</h3><div class="grid2"><div class="field"><label for="aDate">Jour</label><input type="date" id="aDate" data-bind="nb-date" value="'+esc(S.nb.date)+'"></div><div class="field"><label for="aTime">Heure</label><input type="time" id="aTime" data-bind="nb-time" value="'+esc(S.nb.time)+'"></div></div>';
  h+='<div class="field"><label for="aSvc">Prestation</label><select id="aSvc" data-bind="nb-svc">';
  c.services.forEach(function(s){h+='<option value="'+esc(s.id)+'"'+(S.nb.svc===s.id?' selected':'')+'>'+esc(s.name)+'</option>';});
  h+='</select></div><div class="grid2"><div class="field"><label for="aName">Client</label><input type="text" id="aName" data-bind="nb-name" value="'+esc(S.nb.name)+'"></div><div class="field"><label for="aPhone">Téléphone</label><input type="tel" id="aPhone" data-bind="nb-phone" value="'+esc(S.nb.phone)+'"></div></div>';
  if(S.nbErr)h+='<p class="err">'+esc(S.nbErr)+'</p>';
  h+='<button type="button" class="btn" data-act="add-busy">Ajouter</button></div>';
  var list=S.adm.filter(function(b){return b.status==='confirmed'&&b.date>=today();});
  h+='<h3>Confirmés à venir</h3>';
  if(!list.length)return h+'<div class="empty"><strong>Aucun rendez-vous confirmé</strong>Les rendez-vous que vous confirmez apparaissent ici.</div>';
  var cur=null;
  list.forEach(function(b){
    if(cur!==b.date){cur=b.date;h+='<p class="day-h">'+esc(longDate(cur))+'</p>';}
    var conf=S.confirm===b.id;
    h+=admRow(b,conf?'<button type="button" class="btn small danger" data-act="st" data-id="'+b.id+'" data-s="cancelled">Confirmer l’annulation</button><button type="button" class="btn small ghost" data-act="cancel-no">Garder</button>':'<button type="button" class="btn small ghost" data-act="cancel" data-t="'+b.id+'">Annuler</button>');
  });
  return h;
}
function vSettings(){
  if(!S.cfg||!S.draft)return '<div class="empty">Chargement impossible. Actualisez la page.</div>';
  var d=S.draft,h='<h2>Réglages</h2><h3 style="margin-top:8px">Horaires d’ouverture</h3><p class="note">Plusieurs plages possibles le même jour, par exemple 8h à 15h puis 17h à 18h.</p><div class="hours">';
  ORDER.forEach(function(i){
    var x=d.hours[i];
    h+='<div class="hrow"><label class="tog"><input type="checkbox" data-bind="h-open" data-h="'+i+'"'+(x.open?' checked':'')+'>'+DAYS[i]+(x.open?'':' <span class="closed">Fermé</span>')+'</label>';
    if(x.open){
      x.ranges.forEach(function(r,j){
        h+='<div class="rng"><input type="time" aria-label="Début de plage '+(j+1)+', '+DAYS[i]+'" data-bind="h-s" data-h="'+i+'" data-r="'+j+'" value="'+r.s+'"><span class="sep">à</span><input type="time" aria-label="Fin de plage '+(j+1)+', '+DAYS[i]+'" data-bind="h-e" data-h="'+i+'" data-r="'+j+'" value="'+r.e+'">';
        if(x.ranges.length>1)h+='<button type="button" class="btn small ghost" data-act="rm-range" data-h="'+i+'" data-r="'+j+'">Retirer</button>';
        h+='</div>';
      });
      h+='<div class="rng"><button type="button" class="btn small ghost" data-act="add-range" data-h="'+i+'">Ajouter une plage</button></div>';
    }
    h+='</div>';
  });
  h+='</div><h3>Jours de fermeture</h3><div class="addrow"><input type="date" id="closedDate" aria-label="Date de fermeture"><button type="button" class="btn small ghost" data-act="add-closed">Ajouter</button></div>';
  if(d.closed.length){h+='<div class="chips">';d.closed.slice().sort().forEach(function(k){h+='<span class="chip">'+esc(longDate(k))+'<button type="button" aria-label="Retirer" data-act="rm-closed" data-d="'+k+'">×</button></span>';});h+='</div>';}
  h+='<h3>Prestations</h3>';
  d.services.forEach(function(s,i){
    h+='<div class="srow"><input type="text" data-bind="s-name" data-f="name" data-i="'+i+'" aria-label="Nom de la prestation" value="'+esc(s.name)+'"><select data-bind="s-dur" data-i="'+i+'" aria-label="Durée">';
    [15,30,45,60,75,90,120].forEach(function(m){h+='<option value="'+m+'"'+(m===s.dur?' selected':'')+'>'+m+' min</option>';});
    h+='</select><input type="number" min="0" step="0.5" inputmode="decimal" data-bind="s-price" data-i="'+i+'" aria-label="Prix en euros" value="'+s.price+'"><button type="button" class="btn small ghost" data-act="rm-svc" data-i="'+i+'">Retirer</button></div>';
  });
  h+='<button type="button" class="btn small ghost" data-act="add-svc">Ajouter une prestation</button>';
  if(S.settingsErr)h+='<p class="err" style="margin-top:14px">'+esc(S.settingsErr)+'</p>';
  h+='<div class="savebar"><button type="button" class="btn" data-act="save"'+(S.saving?' disabled':'')+'>'+(S.saving?'Enregistrement…':'Enregistrer')+'</button><span class="dirty" id="dirtyNote"'+(S.dirty?'':' hidden')+'>Modifications non enregistrées</span></div>';
  h+='<h3>Code gérant</h3><div class="addrow"><input type="password" id="newCode" aria-label="Nouveau code" autocomplete="new-password" placeholder="Nouveau code (8 caractères minimum)"><button type="button" class="btn small ghost" data-act="set-code">Changer</button></div>';
  return h;
}

/* ---------- utilitaires ---------- */
var toastT=null;
function toast(m){$toast.textContent=m;$toast.hidden=false;clearTimeout(toastT);toastT=setTimeout(function(){$toast.hidden=true;},2800);}
function setDirty(){S.dirty=true;var n=document.getElementById('dirtyNote');if(n)n.hidden=false;}
function reqError(e){
  return {taken:'Ce créneau vient d’être pris. Choisissez une autre heure.',too_many:'Vous avez déjà 3 demandes en attente. Attendez la réponse du salon.',
    name:'Indiquez votre nom et prénom.',phone:'Indiquez un numéro de téléphone valide.',busy:'Trop de demandes en ce moment. Réessayez plus tard.'}[e]||'Ce créneau n’est plus disponible. Choisissez-en un autre.';
}
function netErr(){return 'Impossible de joindre le serveur. Réessayez dans un instant.';}

function setStatus(id,status){
  rpc('mk_admin_set_status',{p_code:S.code,p_id:id,p_status:status}).then(function(r){
    S.confirm=null;
    if(!r.ok&&r.error&&r.error!=='invalid'){logout(true);return;}
    toast(status==='confirmed'?'Rendez-vous confirmé':status==='declined'?'Demande refusée':'Rendez-vous annulé');
    return Promise.all([loadAdmin(),loadPublic()]).then(render);
  },function(){toast(netErr());});
}

/* ---------- événements ---------- */
$tabs.addEventListener('click',function(e){
  var b=e.target.closest('[data-act="tab"]');if(!b)return;
  var v=b.dataset.v;S.view=v;S.err=null;S.confirm=null;if(v!=='mine')S.justSent=false;
  render();
  if(v==='mine')loadMine().then(render);
  else if(v==='book')loadPublic().then(softRender);
  else if(v==='admin'&&S.admin)loadAdmin().then(softRender);
});
$app.addEventListener('click',function(e){
  var t=e.target.closest('[data-act]');if(!t)return;
  var a=t.dataset.act;
  if(a==='reload'){S.loaded=false;render();loadPublic().then(render);}
  else if(a==='day'){S.sel.date=t.dataset.d;S.sel.time=null;S.err=null;render();}
  else if(a==='time'){S.sel.time=t.dataset.t;S.err=null;render();}
  else if(a==='request'){
    var name=S.form.name.trim(),phone=S.form.phone.trim();
    if(name.length<2){S.err='Indiquez votre nom et prénom.';render();return;}
    if(phone.replace(/\D/g,'').length<8){S.err='Indiquez un numéro de téléphone valide.';render();return;}
    try{localStorage.setItem(LS_FORM,JSON.stringify({name:name,phone:phone}));}catch(x){}
    S.sending=true;S.err=null;render();
    rpc('mk_request_booking',{p_date:S.sel.date,p_time:S.sel.time,p_service_id:S.sel.svc,p_name:name,p_phone:phone}).then(function(r){
      S.sending=false;
      if(r.ok){addToken(r.token);S.sel.date=null;S.sel.time=null;S.view='mine';S.justSent=true;toast('Demande envoyée');Promise.all([loadMine(),loadPublic()]).then(render);render();}
      else{S.err=reqError(r.error);if(r.error==='taken'){S.sel.time=null;loadPublic().then(render);}render();}
    },function(){S.sending=false;S.err=netErr();render();});
  }
  else if(a==='cancel'){S.confirm=t.dataset.t;render();}
  else if(a==='cancel-no'){S.confirm=null;render();}
  else if(a==='cancel-yes'){
    rpc('mk_cancel_booking',{p_token:t.dataset.t}).then(function(){S.confirm=null;toast('Rendez-vous annulé');return Promise.all([loadMine(),loadPublic()]).then(render);},function(){toast(netErr());});
  }
  else if(a==='login'){
    var code=document.getElementById('code').value;
    if(!code){S.adminErr='Entrez votre code.';render();return;}
    S.loggingIn=true;S.adminErr=null;render();
    rpc('mk_admin_login',{p_code:code}).then(function(r){
      S.loggingIn=false;
      if(r.ok){S.code=code;try{sessionStorage.setItem(SS_CODE,code);}catch(x){}S.admin=true;S.admView='req';render();loadAdmin().then(render);}
      else{S.adminErr=r.error==='locked'?'Trop d’essais. Réessayez dans 15 minutes.':'Code incorrect.';render();}
    },function(){S.loggingIn=false;S.adminErr=netErr();render();});
  }
  else if(a==='logout')logout();
  else if(a==='refresh'){loadAdmin().then(render);loadPublic();}
  else if(a==='adm'){S.admView=t.dataset.v;S.settingsErr=null;S.nbErr=null;S.confirm=null;if(S.admView==='set'&&!S.dirty)S.draft=clone(S.cfg);render();}
  else if(a==='st')setStatus(t.dataset.id,t.dataset.s);
  else if(a==='add-busy'){
    var nb=S.nb,sv=svcById(nb.svc||S.cfg.services[0].id);
    if(!nb.date||!nb.time){S.nbErr='Choisissez un jour et une heure.';render();return;}
    rpc('mk_admin_add_booking',{p_code:S.code,p_date:nb.date,p_time:nb.time,p_dur:sv?sv.dur:30,p_service:sv?sv.name:'',p_name:nb.name,p_phone:nb.phone}).then(function(r){
      if(r.ok){S.nb.name='';S.nb.phone='';S.nbErr=null;toast('Rendez-vous ajouté');Promise.all([loadAdmin(),loadPublic()]).then(render);}
      else if(r.error==='taken'){S.nbErr='Ce créneau est déjà pris.';render();}
      else if(r.error==='invalid'){S.nbErr='Vérifiez le jour et l’heure.';render();}
      else logout(true);
    },function(){S.nbErr=netErr();render();});
  }
  else if(a==='add-range'){var hh=S.draft.hours[t.dataset.h],lr=hh.ranges[hh.ranges.length-1],ns=Math.min(toMin(lr.e)+60,22*60);hh.ranges.push({s:fromMin(ns),e:fromMin(Math.min(ns+60,23*60+30))});setDirty();render();}
  else if(a==='rm-range'){S.draft.hours[t.dataset.h].ranges.splice(+t.dataset.r,1);setDirty();render();}
  else if(a==='add-closed'){var v=document.getElementById('closedDate').value;if(v&&S.draft.closed.indexOf(v)<0){S.draft.closed.push(v);setDirty();render();}}
  else if(a==='rm-closed'){S.draft.closed=S.draft.closed.filter(function(k){return k!==t.dataset.d;});setDirty();render();}
  else if(a==='add-svc'){S.draft.services.push({id:'s'+rid(),name:'',dur:30,price:0});setDirty();render();}
  else if(a==='rm-svc'){S.draft.services.splice(+t.dataset.i,1);setDirty();render();}
  else if(a==='save')saveCfg();
  else if(a==='set-code'){
    var nc=document.getElementById('newCode').value;
    if(nc.length<8){S.settingsErr='Le code doit avoir au moins 8 caractères.';render();return;}
    rpc('mk_admin_set_code',{p_code:S.code,p_new:nc}).then(function(r){
      if(r.ok){S.code=nc;try{sessionStorage.setItem(SS_CODE,nc);}catch(x){}S.settingsErr=null;toast('Code changé');render();}
      else{S.settingsErr='Le code n’a pas pu être changé.';render();}
    },function(){S.settingsErr=netErr();render();});
  }
});
function saveCfg(){
  if(S.saving)return;
  var d=S.draft,err=null;
  d.services.forEach(function(s){s.name=String(s.name||'').trim();s.price=Number(s.price)||0;s.dur=Number(s.dur)||30;});
  if(!d.services.length)err='Ajoutez au moins une prestation.';
  else if(d.services.some(function(s){return !s.name;}))err='Chaque prestation doit avoir un nom.';
  else{
    for(var i=0;i<7&&!err;i++){
      var h=d.hours[i];if(!h.open)continue;
      var rs=h.ranges.slice().sort(function(x,y){return toMin(x.s)-toMin(y.s);});
      for(var j=0;j<rs.length;j++){
        if(!rs[j].s||!rs[j].e||toMin(rs[j].e)<=toMin(rs[j].s)){err='Une plage de '+DAYS[i]+' se termine avant son début.';break;}
        if(j>0&&toMin(rs[j].s)<toMin(rs[j-1].e)){err='Deux plages de '+DAYS[i]+' se chevauchent.';break;}
      }
      h.ranges=rs;
    }
  }
  S.settingsErr=err;
  if(err){render();return;}
  S.saving=true;render();
  rpc('mk_admin_save_config',{p_code:S.code,p_config:d}).then(function(r){
    S.saving=false;
    if(r.ok){S.cfg=normalize(clone(d));S.dirty=false;toast('Réglages enregistrés');render();}
    else if(r.error==='invalid'){S.settingsErr='Réglages invalides.';render();}
    else logout(true);
  },function(){S.saving=false;S.settingsErr=netErr();render();});
}
$app.addEventListener('input',function(e){
  var t=e.target,b=t.dataset.bind;if(!b)return;
  if(b==='name')S.form.name=t.value;
  else if(b==='phone')S.form.phone=t.value;
  else if(b==='nb-date')S.nb.date=t.value;
  else if(b==='nb-time')S.nb.time=t.value;
  else if(b==='nb-name')S.nb.name=t.value;
  else if(b==='nb-phone')S.nb.phone=t.value;
  else if(b==='h-s'){S.draft.hours[t.dataset.h].ranges[+t.dataset.r].s=t.value;setDirty();}
  else if(b==='h-e'){S.draft.hours[t.dataset.h].ranges[+t.dataset.r].e=t.value;setDirty();}
  else if(b==='s-name'){S.draft.services[+t.dataset.i].name=t.value;setDirty();}
  else if(b==='s-price'){S.draft.services[+t.dataset.i].price=t.value;setDirty();}
});
$app.addEventListener('change',function(e){
  var t=e.target,b=t.dataset.bind;if(!b)return;
  if(b==='svc'){S.sel.svc=t.value;S.sel.time=null;S.err=null;render();}
  else if(b==='nb-svc')S.nb.svc=t.value;
  else if(b==='h-open'){S.draft.hours[t.dataset.h].open=t.checked;setDirty();render();}
  else if(b==='s-dur'){S.draft.services[+t.dataset.i].dur=Number(t.value);setDirty();}
});

/* ---------- démarrage ---------- */
render();
loadPublic().then(function(){
  if(S.cfg&&!S.nb.svc&&S.cfg.services.length)S.nb.svc=S.cfg.services[0].id;
  render();
  loadMine().then(softRender);
  if(S.code)rpc('mk_admin_login',{p_code:S.code}).then(function(r){if(r.ok){S.admin=true;loadAdmin().then(softRender);}else{logout(true);}},function(){});
});
setInterval(function(){
  if(document.visibilityState!=='visible')return;
  if(S.view==='mine')loadMine().then(softRender);
  else if(S.view==='admin'&&S.admin)loadAdmin().then(softRender);
  else if(S.view==='book'&&!S.sending)loadPublic().then(softRender);
},30000);
})();
