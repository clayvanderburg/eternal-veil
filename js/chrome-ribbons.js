// Bounded ribbon surfaces, sorted back-to-front; no additive bloom.
const ChromeRibbons = {
    point(r, u, t, layerCount=18) {
        // Keep the whole family inside a stable visual envelope. More layers
        // pack closer together instead of simply pushing new ribbons offscreen.
        const a=u*Math.PI*2, phase=r*1.71;
        // A smaller central opening gives the composition a deeper inward pull,
        // while the outer envelope still fills the display at every layer count.
        const progress=r/Math.max(1,layerCount-1);
        const radius=0.065+Math.pow(progress,0.88)*0.6;
        const twist=a+t*(r%2?-0.065:0.08)+phase;
        const ripple=1+0.13*Math.sin(a*3+t*0.19+phase);
        // Radius-relative deformation avoids cusps in the small inner loops.
        return {x:Math.cos(twist)*radius*ripple+radius*0.09*Math.sin(a*2+t*0.13+phase),
            y:Math.sin(twist)*radius*ripple*0.81+radius*0.10*Math.cos(a*3-t*0.17+phase),
            z:Math.sin(a*2+t*0.22+phase),
            width:(0.010+radius*0.032)*(0.28+0.70*Math.sqrt(0.04+Math.cos(a*2-t*0.2+phase)**2))};
    },
    draw(ctx,w,h,time,settings,palette) {
        const extent=Math.hypot(w,h)*0.68*Math.max(0.5,Math.min(2,settings.zoom||1));
        // Density is deliberately translated into the Liquid Chrome layer count.
        // 1920 is its signature 18-ribbon composition; Flow may explore 8–24.
        const countValue=Math.max(8,Math.min(24,(settings.density||1920)/(1920/18)));
        const wholeCount=Math.floor(countValue);
        const trailingAlpha=countValue-wholeCount;
        const ribbons=[];
        for(let r=0;r<wholeCount+(trailingAlpha>0.001?1:0);r++) {
            // Small inner loops need fewer vertices than the broad outer folds.
            // Keep the outer silhouette smooth without rasterizing 192 points
            // on every ribbon, including loops only a few pixels across.
            const steps=Math.round(80+96*r/Math.max(1,countValue-1));
            const points=[];
            for(let i=0;i<=steps;i++) points.push(this.point(r,i/steps,time,countValue));
            // Shared vertex normals make the two edges one continuous surface.
            for(let i=0;i<=steps;i++) {
                const prev=points[(i+steps-1)%steps],next=points[(i+1)%steps];
                const dx=next.x-prev.x,dy=next.y-prev.y,len=Math.hypot(dx,dy)||1;
                points[i].nx=-dy/len; points[i].ny=dx/len;
            }
            ribbons.push({r,points,alpha:r<wholeCount?1:trailingAlpha});
        }
        // Stable whole-surface order: no individual facets popping through neighbors.
        // This is layered 2D occlusion, not a physical 3D collision simulation.
        ribbons.sort((a,b)=>b.r-a.r);
        ctx.save(); ctx.globalCompositeOperation='source-over'; ctx.globalAlpha=1;
        const size=Math.max(0.4,Math.min(2.5,(settings.baseSize||6)/6));
        const furthestRibbon=Math.max(1,ribbons.length-1);
        for(const {r,points,alpha} of ribbons) {
            const color=palette[r%palette.length]||'#94a3b8';
            // Near ribbons are larger, brighter and more opaque; distant ones
            // recede gently. This restores depth without returning to faceted seams.
            const depth=1-r/furthestRibbon;
            const layerScale=0.9+depth*0.18;
            const left=[],right=[];
            let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity,averageWidth=0;
            for(const point of points) {
                const x=w/2+point.x*extent*layerScale,y=h/2+point.y*extent*layerScale,half=point.width*extent*size*layerScale;
                left.push([x-point.nx*half,y-point.ny*half]);
                right.push([x+point.nx*half,y+point.ny*half]);
                minX=Math.min(minX,x-half); minY=Math.min(minY,y-half);
                maxX=Math.max(maxX,x+half); maxY=Math.max(maxY,y+half);
                averageWidth+=half;
            }
            averageWidth/=points.length;
            const shade=ctx.createLinearGradient(minX,minY,maxX,maxY);
            const shine=0.42+0.15*Math.sin(time*0.24+r*1.7);
            for(const [p,c] of [[0,'#050811'],[0.16,color],[shine,'#dbe5ed'],[shine+0.09,'#f8fafc'],[shine+0.22,'#263044'],[0.86,color],[1,'#060912']]) shade.addColorStop(Math.min(1,p),c);
            ctx.globalAlpha=alpha*(0.58+depth*0.42);
            ctx.beginPath(); ctx.moveTo(...left[0]);
            for(let i=1;i<left.length;i++) ctx.lineTo(...left[i]);
            for(let i=right.length-1;i>=0;i--) ctx.lineTo(...right[i]);
            ctx.closePath(); ctx.fillStyle=shade; ctx.fill();

            // One continuous highlight path removes the old faceted, segmented-hose look.
            ctx.beginPath(); ctx.moveTo(w/2+points[0].x*extent*layerScale,h/2+points[0].y*extent*layerScale);
            for(let i=1;i<points.length;i++) ctx.lineTo(w/2+points[i].x*extent*layerScale,h/2+points[i].y*extent*layerScale);
            ctx.strokeStyle='#dbe5ed'; ctx.globalAlpha=alpha*(0.08+depth*0.2+0.06*Math.sin(time*0.27+r));
            ctx.lineWidth=Math.max(1,averageWidth*(0.2+depth*0.2)); ctx.lineCap='round'; ctx.lineJoin='round'; ctx.stroke();
        }
        ctx.restore();
    }
};
if(typeof window!=='undefined') window.ChromeRibbons=ChromeRibbons;
if(typeof module!=='undefined') module.exports=ChromeRibbons;
