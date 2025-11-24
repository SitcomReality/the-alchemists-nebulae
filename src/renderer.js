import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { SYSTEM_SIZE, TYPES, PALETTE } from './utils.js';

export class Renderer {
    constructor(container) {
        this.container = container;
        this.scene = new THREE.Scene();
        
        // Camera setup
        const aspect = container.clientWidth / container.clientHeight;
        this.camera = new THREE.PerspectiveCamera(60, aspect, 0.1, 1000);
        this.camera.position.set(SYSTEM_SIZE * 1.2, SYSTEM_SIZE * 0.8, SYSTEM_SIZE * 1.2);
        this.camera.lookAt(0,0,0);

        // Renderer setup
        this.renderer = new THREE.WebGLRenderer({ antialias: false }); // False for bloom perf
        this.renderer.setSize(container.clientWidth, container.clientHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        this.renderer.toneMapping = THREE.ReinhardToneMapping;
        container.appendChild(this.renderer.domElement);

        // Controls
        this.controls = new OrbitControls(this.camera, this.renderer.domElement);
        this.controls.enableDamping = true;
        this.controls.autoRotate = true;
        this.controls.autoRotateSpeed = 0.5;

        // Lights
        const ambient = new THREE.AmbientLight(0x222222);
        this.scene.add(ambient);
        const point = new THREE.PointLight(0xffffff, 1, 100);
        point.position.set(10, 20, 10);
        this.scene.add(point);

        // Background
        const loader = new THREE.TextureLoader();
        loader.load('noise_texture.png', (texture) => {
            texture.mapping = THREE.EquirectangularReflectionMapping;
            this.scene.background = texture;
            this.scene.environment = texture;
        });

        // Instanced Mesh for Cells
        // We use a BoxGeometry or SphereGeometry
        const geometry = new THREE.BoxGeometry(0.8, 0.8, 0.8);
        const material = new THREE.MeshStandardMaterial({
            color: 0xffffff,
            roughness: 0.2,
            metalness: 0.8,
            emissive: 0x000000
        }); 
        
        this.meshCount = SYSTEM_SIZE ** 3;
        this.instancedMesh = new THREE.InstancedMesh(geometry, material, this.meshCount);
        this.instancedMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        this.instancedMesh.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(this.meshCount * 3), 3);
        this.scene.add(this.instancedMesh);

        // Dummy object for matrix calculations
        this.dummy = new THREE.Object3D();

        // Post Processing (Bloom)
        this.composer = new EffectComposer(this.renderer);
        const renderPass = new RenderPass(this.scene, this.camera);
        this.composer.addPass(renderPass);

        const bloomPass = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 1.5, 0.4, 0.85);
        bloomPass.threshold = 0.1;
        bloomPass.strength = 1.5; // High bloom for nebula look
        bloomPass.radius = 0.5;
        this.composer.addPass(bloomPass);

        // Resize handler
        window.addEventListener('resize', this.onWindowResize.bind(this));
    }

    onWindowResize() {
        this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
        this.composer.setSize(this.container.clientWidth, this.container.clientHeight);
    }

    render(simulation) {
        const { types, energy } = simulation.getCurrentState();
        const size = simulation.size;
        let instanceIdx = 0;

        const offset = size / 2;

        for (let z = 0; z < size; z++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const i = z * size * size + y * size + x;
                    const type = types[i];
                    const energVal = energy[i];

                    if (type !== TYPES.VOID) {
                        // Position
                        this.dummy.position.set(x - offset, y - offset, z - offset);
                        
                        // Scale based on energy/pulse
                        const scale = 0.2 + energVal * 0.8;
                        this.dummy.scale.set(scale, scale, scale);
                        
                        // Rotate slowly based on energy?
                        // Calculating rotation per frame for 10k objects is heavy. Skip.
                        
                        this.dummy.updateMatrix();
                        this.instancedMesh.setMatrixAt(instanceIdx, this.dummy.matrix);
                        
                        // Color
                        const baseColor = PALETTE[type];
                        // Mix with white based on energy for "glow"
                        const r = baseColor[0] + energVal * 0.5;
                        const g = baseColor[1] + energVal * 0.5;
                        const b = baseColor[2] + energVal * 0.5;
                        
                        this.instancedMesh.setColorAt(instanceIdx, new THREE.Color(r, g, b));
                        instanceIdx++;
                    }
                }
            }
        }

        // Hide unused instances
        for (let i = instanceIdx; i < this.meshCount; i++) {
             this.instancedMesh.setMatrixAt(i, new THREE.Matrix4().makeScale(0,0,0));
        }

        this.instancedMesh.instanceMatrix.needsUpdate = true;
        this.instancedMesh.instanceColor.needsUpdate = true;

        this.controls.update();
        this.composer.render();
    }
}