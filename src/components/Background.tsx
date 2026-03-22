import React, { useEffect, useRef, useState } from 'react';
import { useVibe } from '../store/VibeContext';

const vertexShaderSource = `#version 300 es
  in vec2 position;
  void main() {
    gl_Position = vec4(position, 0.0, 1.0);
  }
`;

const rainShaderSource = `#version 300 es
  precision highp float;
  uniform vec2 u_resolution;
  uniform vec2 u_imageResolution;
  uniform float u_time;
  uniform float u_intensity;
  uniform float u_blur;
  uniform float u_dimness;
  uniform float u_speed;
  uniform sampler2D u_texture;

  out vec4 fragColor;

  #define S(a, b, t) smoothstep(a, b, t)

  vec3 N13(float p) {
     vec3 p3 = fract(vec3(p) * vec3(.1031,.11369,.13787));
     p3 += dot(p3, p3.yzx + 19.19);
     return fract(vec3((p3.x + p3.y)*p3.z, (p3.x+p3.z)*p3.y, (p3.y+p3.z)*p3.x));
  }

  float N(float t) {
      return fract(sin(t*12345.564)*7658.76);
  }

  float Saw(float b, float t) {
      return S(0., b, t)*S(1., b, t);
  }

  vec2 DropLayer2(vec2 uv, float t) {
      vec2 UV = uv;
      
      uv.y += t*0.75;
      vec2 a = vec2(6., 1.);
      vec2 grid = a*2.;
      vec2 id = floor(uv*grid);
      
      float colShift = N(id.x); 
      uv.y += colShift;
      
      id = floor(uv*grid);
      vec3 n = N13(id.x*35.2+id.y*2376.1);
      vec2 st = fract(uv*grid)-vec2(.5, 0.0);
      
      float x = n.x-.5;
      
      float y = UV.y*20.;
      float wiggle = sin(y+sin(y));
      x += wiggle*(.5-abs(x))*(n.z-.5);
      x *= .7;
      float ti = fract(t+n.z);
      y = (Saw(.85, ti)-.5)*.9+.5;
      vec2 p = vec2(x, y);
      
      float d = length((st-p)*a.yx);
      
      float mainDrop = S(.4, .0, d);
      
      float r = sqrt(S(1., y, st.y));
      float cd = abs(st.x-x);
      float trail = S(.23*r, .15*r*r, cd);
      float trailFront = S(-.02, .02, st.y-y);
      trail *= trailFront*r*r;
      
      y = UV.y;
      float trail2 = S(.2*r, .0, cd);
      float droplets = max(0., (sin(y*(1.-y)*120.)-st.y))*trail2*trailFront*n.z;
      y = fract(y*10.)+(st.y-.5);
      float dd = length(st-vec2(x, y));
      droplets = S(.3, 0., dd);
      float m = mainDrop+droplets*r*trailFront;
      
      return vec2(m, trail);
  }

  float StaticDrops(vec2 uv, float t) {
      uv *= 40.;
      
      vec2 id = floor(uv);
      uv = fract(uv)-.5;
      vec3 n = N13(id.x*107.45+id.y*3543.654);
      vec2 p = (n.xy-.5)*.7;
      float d = length(uv-p);
      
      float fade = Saw(.025, fract(t+n.z));
      float c = S(.3, 0., d)*fract(n.z*10.)*fade;
      return c;
  }

  vec2 Drops(vec2 uv, float t, float l0, float l1, float l2) {
      float s = StaticDrops(uv, t)*l0; 
      vec2 m1 = DropLayer2(uv, t)*l1;
      vec2 m2 = DropLayer2(uv*1.85, t)*l2;
      
      float c = s+m1.x+m2.x;
      c = S(.3, 1., c);
      
      return vec2(c, max(m1.y*l0, m2.y*l1));
  }

  vec2 screenToTexUV(vec2 screenUV) {
      vec2 s = u_resolution;
      vec2 i = u_imageResolution;
      float rs = s.x / s.y;
      float ri = i.x / i.y;
      vec2 new = rs < ri ? vec2(i.x * s.y / i.y, s.y) : vec2(s.x, i.y * s.x / i.x);
      vec2 offset = (rs < ri ? vec2((new.x - s.x) / 2.0, 0.0) : vec2(0.0, (new.y - s.y) / 2.0)) / new;
      return screenUV * (s / new) + offset;
  }

  vec3 getBlurredImage(vec2 screenUV, float blurAmount) {
      return textureLod(u_texture, screenToTexUV(screenUV), blurAmount).rgb;
  }

  void main() {
      vec2 uv = (gl_FragCoord.xy-.5*u_resolution.xy) / u_resolution.y;
      vec2 UV = gl_FragCoord.xy/u_resolution.xy;
      UV.y = 1.0 - UV.y; // Flip Y for texture
      
      float T = u_time * u_speed;
      float t = T*.2;
      
      float rainAmount = mix(0.1, 1.0, u_intensity);
      
      float maxBlur = mix(3., 6., rainAmount) * (0.2 + u_blur * 1.5);
      float minBlur = 0.;
      
      // Removed zoom, fixed scale for raindrops
      uv *= 0.8;
      
      float staticDrops = S(-.5, 1., rainAmount)*2.;
      float layer1 = S(.25, .75, rainAmount);
      float layer2 = S(.0, .5, rainAmount);
      
      vec2 c = Drops(uv, t, staticDrops, layer1, layer2);
      
      vec2 e = vec2(.001, 0.);
      float cx = Drops(uv+e, t, staticDrops, layer1, layer2).x;
      float cy = Drops(uv+e.yx, t, staticDrops, layer1, layer2).x;
      vec2 n = vec2(cx-c.x, cy-c.x);
      
      // Wiping effect: Drops (c.x) and trails (c.y) clear the fog
      float clearFactor = clamp(c.x * 2.0 + c.y * 2.0, 0.0, 1.0);
      float focus = mix(maxBlur, minBlur, clearFactor);
      
      vec3 col = getBlurredImage(UV + n, focus);
      
      // Darken background based on dimness setting
      col *= (1.0 - u_dimness);
      
      fragColor = vec4(col, 1.0);
  }
`;

const snowShaderSource = `#version 300 es
  precision highp float;
  uniform vec2 u_resolution;
  uniform vec2 u_imageResolution;
  uniform float u_time;
  uniform float u_intensity;
  uniform float u_blur;
  uniform float u_dimness;
  uniform float u_speed;
  uniform sampler2D u_texture;

  out vec4 fragColor;

  #define LAYERS 25
  #define DEPTH .5
  #define WIDTH .3
  #define SPEED .6

  vec2 screenToTexUV(vec2 screenUV) {
      vec2 s = u_resolution;
      vec2 i = u_imageResolution;
      float rs = s.x / s.y;
      float ri = i.x / i.y;
      vec2 new = rs < ri ? vec2(i.x * s.y / i.y, s.y) : vec2(s.x, i.y * s.x / i.x);
      vec2 offset = (rs < ri ? vec2((new.x - s.x) / 2.0, 0.0) : vec2(0.0, (new.y - s.y) / 2.0)) / new;
      return screenUV * (s / new) + offset;
  }

  vec3 getBlurredImage(vec2 screenUV, float blurAmount) {
      return textureLod(u_texture, screenToTexUV(screenUV), blurAmount).rgb;
  }

  void main() {
      const mat3 p = mat3(13.323122,23.5112,21.71123,21.1212,28.7312,11.9312,21.8112,14.7212,61.3934);
      vec2 uv = vec2(1.,u_resolution.y/u_resolution.x)*gl_FragCoord.xy / u_resolution.xy;
      vec2 UV = gl_FragCoord.xy/u_resolution.xy;
      UV.y = 1.0 - UV.y; // Flip Y for texture
      
      vec3 acc = vec3(0.0);
      float dof = 5.*sin(u_time*.1);
      float speed = SPEED * (0.5 + u_intensity * 1.5) * u_speed;
      
      for (int j=0;j<LAYERS;j++) {
          float fi = float(j);
          vec2 q = uv*(1.+fi*DEPTH);
          q += vec2(q.y*(WIDTH*mod(fi*7.238917,1.)-WIDTH*.5),speed*u_time/(1.+fi*DEPTH*.03));
          vec3 n = vec3(floor(q),31.189+fi);
          vec3 m = floor(n)*.00001 + fract(n);
          vec3 mp = (31415.9+m)/fract(p*m);
          vec3 r = fract(mp);
          vec2 st = abs(mod(q,1.)-.5+.9*r.xy-.45);
          st += .01*abs(2.*fract(10.*q.yx)-1.); 
          float d = .6*max(st.x-st.y,st.x+st.y)+max(st.x,st.y)-.01;
          float edge = .005+.05*min(.5*abs(fi-5.-dof),1.);
          acc += vec3(smoothstep(edge,-edge,d)*(r.x/(1.+.02*fi*DEPTH)));
      }
      
      float blurLevel = u_blur * 8.0;
      vec3 bgCol = getBlurredImage(UV, blurLevel);
      bgCol *= (1.0 - u_dimness);
      
      fragColor = vec4(bgCol + acc, 1.0);
  }
`;

export const Background: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { mode, intensity, speed, blur, bgImage, customImages, bgDimness } = useVibe();
  const imageResRef = useRef<{w: number, h: number}>({w: 1920, h: 1080});
  
  // Refs to hold current values for the animation loop
  const modeRef = useRef(mode);
  const intensityRef = useRef(intensity);
  const speedRef = useRef(speed);
  const blurRef = useRef(blur);
  const bgDimnessRef = useRef(bgDimness);

  useEffect(() => {
    modeRef.current = mode;
    intensityRef.current = intensity;
    speedRef.current = speed;
    blurRef.current = blur;
    bgDimnessRef.current = bgDimness;
  }, [mode, intensity, speed, blur, bgDimness]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const gl = canvas.getContext('webgl2', { alpha: true });
    if (!gl) return;

    const compileShader = (source: string, type: number) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const createProgram = (vsSource: string, fsSource: string) => {
      const vs = compileShader(vsSource, gl.VERTEX_SHADER);
      const fs = compileShader(fsSource, gl.FRAGMENT_SHADER);
      if (!vs || !fs) return null;
      const program = gl.createProgram();
      if (!program) return null;
      gl.attachShader(program, vs);
      gl.attachShader(program, fs);
      gl.linkProgram(program);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error(gl.getProgramInfoLog(program));
        return null;
      }
      return program;
    };

    const rainProgram = createProgram(vertexShaderSource, rainShaderSource);
    const snowProgram = createProgram(vertexShaderSource, snowShaderSource);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
      gl.STATIC_DRAW
    );

    // Load background texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));

    const img = new Image();
    img.crossOrigin = "anonymous";
    
    const currentBgUrl = bgImage === 'default1' 
      ? 'https://raw.githubusercontent.com/zyjsgy/vibe_editor/main/public/1.png'
      : bgImage === 'default2'
      ? 'https://images.unsplash.com/photo-1454496522488-7a8e488e8606?auto=format&fit=crop&w=1920&q=80'
      : customImages.find(img => img.id === bgImage)?.url || 'https://raw.githubusercontent.com/zyjsgy/vibe_editor/main/public/1.png';
      
    img.src = currentBgUrl;
    
    img.onload = () => {
      imageResRef.current = { w: img.width, h: img.height };
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, img);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    };
    img.onerror = (err) => {
      console.error("Failed to load background image, falling back to default:", err);
      const fallbackImg = new Image();
      fallbackImg.crossOrigin = "anonymous";
      fallbackImg.src = "https://raw.githubusercontent.com/zyjsgy/vibe_editor/main/public/1.png";
      fallbackImg.onload = () => {
        imageResRef.current = { w: fallbackImg.width, h: fallbackImg.height };
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, fallbackImg);
        gl.generateMipmap(gl.TEXTURE_2D);
      };
    };

    let animationFrameId: number;
    const startTime = performance.now();

    const render = () => {
      // Restore high DPR for crisp raindrops (textureLod optimization keeps performance good)
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const width = Math.floor(window.innerWidth * dpr);
      const height = Math.floor(window.innerHeight * dpr);
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
        gl.viewport(0, 0, width, height);
      }

      const program = modeRef.current === 'rain' ? rainProgram : snowProgram;
      if (!program) return;

      gl.useProgram(program);

      // Bind texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      const textureLocation = gl.getUniformLocation(program, 'u_texture');
      gl.uniform1i(textureLocation, 0);

      const positionLocation = gl.getAttribLocation(program, 'position');
      gl.enableVertexAttribArray(positionLocation);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

      const resolutionLocation = gl.getUniformLocation(program, 'u_resolution');
      const imageResolutionLocation = gl.getUniformLocation(program, 'u_imageResolution');
      const timeLocation = gl.getUniformLocation(program, 'u_time');
      const intensityLocation = gl.getUniformLocation(program, 'u_intensity');
      const speedLocation = gl.getUniformLocation(program, 'u_speed');
      const blurLocation = gl.getUniformLocation(program, 'u_blur');
      const dimnessLocation = gl.getUniformLocation(program, 'u_dimness');

      gl.uniform2f(resolutionLocation, width, height);
      gl.uniform2f(imageResolutionLocation, imageResRef.current.w, imageResRef.current.h);
      
      gl.uniform1f(timeLocation, (performance.now() - startTime) / 1000);
      gl.uniform1f(intensityLocation, intensityRef.current);
      gl.uniform1f(speedLocation, speedRef.current);
      gl.uniform1f(blurLocation, blurRef.current);
      gl.uniform1f(dimnessLocation, bgDimnessRef.current);

      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.drawArrays(gl.TRIANGLES, 0, 6);

      animationFrameId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animationFrameId);
      if (rainProgram) gl.deleteProgram(rainProgram);
      if (snowProgram) gl.deleteProgram(snowProgram);
    };
  }, [bgImage, customImages]);

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden bg-black">
      <canvas
        ref={canvasRef}
        className="absolute inset-0 w-full h-full"
      />
    </div>
  );
};
