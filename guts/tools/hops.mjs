import { launch } from './cdp.mjs';
const p = await launch({ url: process.env.GUTS_URL || 'http://localhost:8765/guts/index.html', w: 1280, h: 800 });
await p.sleep(2200);
await p.eval('__guts.startLevel()'); await p.sleep(300);
const res = await p.eval(`(function(){
  var G=GUTS, Game=G.Game, K=G.Input._keys, T=32, st=Game.st, g=st.g, out=[];
  function hop(name, x0, feetRow0, dir, tx0, tx1, feetRowT, vit){
    for (var off=0; off<=2.0; off+=0.25) for (var delay=0; delay<=24; delay+=4) {
      st.b.vit=vit; st.b.pres=0; g.x=(x0+off*dir*-1)*T; g.y=feetRow0*T; g.vx=0; g.vy=0; g.grounded=true;
      var hit=false;
      K.ArrowRight=dir>0; K.ArrowLeft=dir<0; K.Space=false;
      for (var f=0; f<100; f++){ if (f===delay) K.Space=true; if (f===delay+28) K.Space=false; Game.step(1/60); st.b.pres=0; if (g.grounded && Math.abs(g.y-feetRowT*T)<2 && g.x/T>=tx0 && g.x/T<=tx1) { hit=true; break; } }
      K.ArrowRight=false; K.ArrowLeft=false; K.Space=false;
      if (hit) { out.push(name+': ok (start '+(x0-off*dir).toFixed(2)+', jump after '+delay+' frames, vitality '+vit+')'); return true; }
    }
    out.push(name+': FAILED at vitality '+vit); return false;
  }
  var allOk=true;
  [15,55].forEach(function(v){
    allOk = hop('floor -> shelf1 (row12)', 44.4, 14, 1, 45, 47, 12, v) && allOk;
    allOk = hop('shelf1 -> shelf2 (row10)', 46.2, 12, 1, 47, 49, 10, v) && allOk;
    allOk = hop('shelf2 -> shelf3 (row8)', 48.2, 10, 1, 49, 51, 8, v) && allOk;
    allOk = hop('shelf3 -> shelf4 (row6)', 50.2, 8, 1, 51, 52, 6, v) && allOk;
    allOk = hop('shelf4 -> fridge top (row4)', 51.4, 6, 1, 52, 55, 4, v) && allOk;
    allOk = hop('floor -> crate1 (row12)', 105.2, 14, 1, 106, 108, 12, v) && allOk;
    allOk = hop('crate1 -> crate2 (row10)', 107.2, 12, 1, 108, 110, 10, v) && allOk;
    allOk = hop('crate2 -> fence top (row8)', 109.2, 10, 1, 110, 113, 8, v) && allOk;
    allOk = hop('table: floor -> step (row12)', 20.4, 14, 1, 21, 24, 12, v) && allOk;
    allOk = hop('step -> counter (row10)', 23.2, 12, 1, 24, 31, 10, v) && allOk;
  });
  return { allOk: allOk, out: out };
})()`);
console.log(res.out.join('\n')); console.log('ALL OK:', res.allOk);
p.close();
