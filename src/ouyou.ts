// 学籍番号: 23FI087
// 氏名: 成田薫平
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls";

class ThreeJSContainer {
    private scene: THREE.Scene;
    private light: THREE.Light;

    constructor() {
        this.scene = new THREE.Scene();
    }

   
    private async readMaterialFile(filePath: string): Promise<string> {
        const mtlStr = await readFile(filePath);
        const lines = mtlStr.split("\n");
        let textureFile = "";

        for(let line of lines) {
            const parts = line.trim().split(/\s+/);
            if(parts[0] === "map_Kd") {
                textureFile = parts[1];
                break;
            }
        }
        return textureFile;
    }

    // テクスチャをロード
    private loadTexture(texturePath: string): Promise<THREE.Texture> {
        return new Promise((resolve) => {
            const textureLoader = new THREE.TextureLoader();
            textureLoader.load(texturePath, (texture) => {
                resolve(texture);
            });
        });
    }

    
    public createRendererDOM = async (width: number, height: number, cameraPos: THREE.Vector3) => {
        const renderer = new THREE.WebGLRenderer();
        renderer.setSize(width, height);
        renderer.setClearColor(new THREE.Color(0x495ed));
        renderer.shadowMap.enabled = true; 

        //カメラの設定
        const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000);
        camera.position.copy(cameraPos);
        camera.lookAt(new THREE.Vector3(0, 0, 0));

        const orbitControls = new OrbitControls(camera, renderer.domElement);

        
        await this.createScene();
        
        const render: FrameRequestCallback = (time) => {
            orbitControls.update();

            renderer.render(this.scene, camera);
            requestAnimationFrame(render);
        }
        requestAnimationFrame(render);

        renderer.domElement.style.cssFloat = "left";
        renderer.domElement.style.margin = "10px";
        return renderer.domElement;
    }

    private createScene = async () => {
        this.scene = new THREE.Scene();
        
        // OBJファイルの読み込み
        await this.addSceneFromObjFile("dice.obj");

        //ライトの設定
        this.light = new THREE.DirectionalLight(0xffffff);
        const lvec = new THREE.Vector3(1, 1, 1).normalize();
        this.light.position.set(lvec.x, lvec.y, lvec.z);
        this.scene.add(this.light);
    }

    private async addSceneFromObjFile(filePath: string) {  
        const meshStr = await readFile(filePath);
        let mtlFileName = "";
        let vertices: number[] = [];
        let uvs: number[] = [];
        let vertexIndices: number[] = [];
        let uvIndices: number[] = [];
        let finalVertices: number[] = [];
        let finalUvs: number[] = [];

        const meshLines = meshStr.split("\n");
        for(let i = 0; i < meshLines.length; ++i) {
            const meshLine = meshLines[i].trim();
            const meshSpaceSplitArray = meshLine.split(/\s+/);

            const meshType = meshSpaceSplitArray[0];
            if(meshType === "mtllib") {
                mtlFileName = meshSpaceSplitArray[1];
            } else if(meshType === "v") {
                vertices.push(parseFloat(meshSpaceSplitArray[1]));
                vertices.push(parseFloat(meshSpaceSplitArray[2]));
                vertices.push(parseFloat(meshSpaceSplitArray[3]));
            } else if(meshType === "vt") {
                uvs.push(parseFloat(meshSpaceSplitArray[1]));
                uvs.push(parseFloat(meshSpaceSplitArray[2]));
            } else if(meshType === "f") {
                for(let j = 1; j <= 3; j++) {
                    const indices = meshSpaceSplitArray[j].split("/");
                    const vertexIndex = parseInt(indices[0]) - 1;
                    const uvIndex = parseInt(indices[1]) - 1;
                    
                    // 頂点座標の複製
                    finalVertices.push(vertices[vertexIndex * 3]);
                    finalVertices.push(vertices[vertexIndex * 3 + 1]);
                    finalVertices.push(vertices[vertexIndex * 3 + 2]);
                    
                    // UV座標の複製
                    finalUvs.push(uvs[uvIndex * 2]);
                    finalUvs.push(uvs[uvIndex * 2 + 1]);
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(finalVertices), 3));
        geometry.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(finalUvs), 2));
        geometry.computeVertexNormals();

        // テクスチャの読み込みと設定
        const textureFile = await this.readMaterialFile(mtlFileName);
        const texture = await this.loadTexture(textureFile);
        const material = new THREE.MeshBasicMaterial({ map: texture });

        const mesh = new THREE.Mesh(geometry, material);
        this.scene.add(mesh);
    }
    
}

async function readFile(path): Promise<string> {
    return new Promise((resolve => {
        const loader = new THREE.FileLoader();
        loader.load(path, (data) => {
                if(typeof data === "string") {
                    resolve(data);
                } else {
                    const decoder = new TextDecoder('utf-8');
                    const decodedString = decoder.decode(data);
                    resolve(decodedString);
                }
            },
        );
    }));
}


window.addEventListener("DOMContentLoaded", init);

async function init() { 
    let container = new ThreeJSContainer();

    let viewport = await container.createRendererDOM(640, 480, new THREE.Vector3(0, 0, 3)); 
    document.body.appendChild(viewport);
}
