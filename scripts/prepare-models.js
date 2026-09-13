import fs from 'node:fs/promises';
import sharp from 'sharp';
// Preserve geometry/accessor layout, rebuilding buffer views with compressed embedded textures.
for (const name of ['road', 'tree', 'groundcover']) {
 const input=await fs.readFile(`assets/source/${name}.glb`),jsonLength=input.readUInt32LE(12),json=JSON.parse(input.subarray(20,20+jsonLength)),bin=input.subarray(28+jsonLength);
 const images=new Map(json.images.map(image=>[image.bufferView,image]));let offset=0;const chunks=[];
 for(let i=0;i<json.bufferViews.length;i++) {
  const view=json.bufferViews[i];let bytes=bin.subarray(view.byteOffset||0,(view.byteOffset||0)+view.byteLength);
  if(images.has(i)) {bytes=await sharp(bytes).resize({width:1024,height:1024,fit:'inside',withoutEnlargement:true}).webp({quality:88}).toBuffer();images.get(i).mimeType='image/webp';}
  view.byteOffset=offset;view.byteLength=bytes.length;chunks.push(bytes);offset+=bytes.length;const padding=(4-offset%4)%4;chunks.push(Buffer.alloc(padding));offset+=padding;
 }
 json.buffers[0].byteLength=offset;
 // EXT_texture_webp is required for glTF WebP image sources.
 json.extensionsUsed=[...new Set([...(json.extensionsUsed||[]),'EXT_texture_webp'])];json.extensionsRequired=[...new Set([...(json.extensionsRequired||[]),'EXT_texture_webp'])];
 for(const texture of json.textures){texture.extensions={...texture.extensions,EXT_texture_webp:{source:texture.source}};delete texture.source;}
 const raw=Buffer.from(JSON.stringify(json)),padded=Buffer.alloc(Math.ceil(raw.length/4)*4,32);raw.copy(padded);
 const header=Buffer.alloc(20);header.writeUInt32LE(0x46546c67);header.writeUInt32LE(2,4);header.writeUInt32LE(28+padded.length+offset,8);header.writeUInt32LE(padded.length,12);header.writeUInt32LE(0x4e4f534a,16);
 const binHeader=Buffer.alloc(8);binHeader.writeUInt32LE(offset);binHeader.writeUInt32LE(0x004e4942,4);
 const output=Buffer.concat([header,padded,binHeader,...chunks]);await fs.writeFile(`public/assets/models/${name}.glb`,output);console.log(name,input.length,'→',output.length);
}
