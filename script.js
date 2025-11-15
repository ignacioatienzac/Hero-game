// Espera a que el DOM esté completamente cargado
document.addEventListener('DOMContentLoaded', () => {

    // --- 1. OBTENER REFERENCIAS AL DOM ---
    
    // Contenedores del juego
    const appContainer = document.getElementById('app-container');
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    
    // Contenedores del mini-juego
    const verbEl = document.getElementById('verb');
    const tenseEl = document.getElementById('tense');
    const pronounEl = document.getElementById('pronoun');
    const answerInput = document.getElementById('answer-input');
    const submitButton = document.getElementById('submit-answer');
    const messageEl = document.getElementById('minigame-message');
    const writeModeContainer = document.getElementById('write-mode-container');
    const choiceModeContainer = document.getElementById('choice-mode-container');
    const choiceGrid = document.getElementById('choice-grid');
    const choiceVerbEl = document.getElementById('choice-verb');
    const choicePronounEl = document.getElementById('choice-pronoun');

    // Overlays de UI
    const selectionOverlay = document.getElementById('selection-overlay');
    const gameOverOverlay = document.getElementById('game-over-overlay');
    const finalScoreEl = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');

    // Elementos de la pantalla de selección
    const tenseSelectionDiv = document.getElementById('tense-selection');
    const typeSelectionDiv = document.getElementById('type-selection');
    const tenseButtons = document.querySelectorAll('.btn-tense');
    const typeButtons = document.querySelectorAll('.btn-type');
    const difficultySelectionDiv = document.getElementById('difficulty-selection');
    const difficultyButtons = document.querySelectorAll('.btn-difficulty');
    const modeSelectionDiv = document.getElementById('mode-selection');
    const modeButtons = document.querySelectorAll('.btn-mode');
    const choiceModeButton = document.querySelector('.btn-mode[data-mode="choice"]');
    const writeModeButton = document.querySelector('.btn-mode[data-mode="write"]');
    const startButton = document.getElementById('start-game-button');
    const selectionErrorEl = document.getElementById('selection-error');
    const modeRestrictionMessage = document.getElementById('mode-restriction-message');
    const gameOverTitleEl = document.querySelector('.game-over-title');
    const gameOverSubtitleEl = document.querySelector('.game-over-subtitle');

    // --- 2. VARIABLES DE ESTADO DEL JUEGO ---

    // Variables de selección
    let selectedTense = null;
    let selectedVerbType = null;
    let selectedTenseLabel = '';
    let masterVerbos = []; // Aquí se cargarán los verbos del JSON
    let verbos = []; // Lista filtrada para la partida actual
    let preguntaActual = {};
    let selectedDifficulty = null;
    let selectedMode = null;

    // Variables del juego principal
    let heroe;
    let monstruos = [];
    let proyectiles = [];
    let vidas;
    let puntuacion;
    let poderAtaque;
    let poderAtaqueMaximo;
    let gameOver;
    let ultimoSpawn;
    let spawnRate; // en ms
    let alturaTerreno;
    let gameLoopId; // Para poder detener el bucle del juego
    let castillo;
    let objetivoPuntuacion;
    let dificultadActual;
    let choiceCells = [];

    // --- 3. FUNCIÓN PRINCIPAL DE INICIO ---

    const spritePaths = {
        heroe: 'images/Heroe.png',
        castillo: 'images/Castillo.png'
    };

    const PODER_ATAQUE_MINIMO = 1;
    const CHOICE_MODE_VERBS = ['hablar', 'comer', 'vivir'];
    const CHOICE_MODE_GRID_SIZES = {
        facil: 6,
        intermedio: 8,
        dificil: 8
    };
    const CHOICE_MODE_COLUMNS = {
        facil: 3,
        intermedio: 4,
        dificil: 4
    };

    const WRITE_MODE_ACCENT_KEYS = {
        '1': 'á',
        '2': 'é',
        '3': 'í',
        '4': 'ó',
        '5': 'ú'
    };

    const ATTACK_VISUAL_TIERS = [
        {
            min: PODER_ATAQUE_MINIMO,
            max: 5,
            projectilePath: 'images/proyectil-1.png',
            auraPath: null
        },
        {
            min: 6,
            max: 10,
            projectilePath: 'images/proyectil-2.png',
            auraPath: 'images/aura-1.png'
        },
        {
            min: 11,
            max: 20,
            projectilePath: 'images/proyectil-3.png',
            auraPath: 'images/aura-2.png'
        },
        {
            min: 21,
            max: 30,
            projectilePath: 'images/proyectil-4.png',
            auraPath: 'images/aura-3.png'
        },
        {
            min: 31,
            max: 50,
            projectilePath: 'images/proyectil-5.png',
            auraPath: 'images/aura-4.png'
        },
        {
            min: 51,
            max: Infinity,
            projectilePath: 'images/proyectil-6.png',
            auraPath: 'images/aura-5.png'
        }
    ];

    function obtenerTierVisual(poder) {
        const poderNormalizado = Math.max(PODER_ATAQUE_MINIMO, poder);
        for (let i = 0; i < ATTACK_VISUAL_TIERS.length; i++) {
            const tier = ATTACK_VISUAL_TIERS[i];
            const min = tier.min ?? PODER_ATAQUE_MINIMO;
            const max = tier.max ?? Infinity;
            if (poderNormalizado >= min && poderNormalizado <= max) {
                return { tier, index: i };
            }
        }
        const ultimoIndice = ATTACK_VISUAL_TIERS.length - 1;
        return { tier: ATTACK_VISUAL_TIERS[ultimoIndice], index: ultimoIndice };
    }

    function obtenerSpriteAura(poder) {
        const { tier } = obtenerTierVisual(poder);
        if (!tier.auraPath) {
            return null;
        }
        return sprites.auras[tier.auraPath] || null;
    }

    function obtenerConfiguracionProyectil(poder) {
        const { tier, index } = obtenerTierVisual(poder);
        const sprite = tier.projectilePath ? sprites.proyectiles[tier.projectilePath] || null : null;

        let width = 24;
        let height = 12;

        if (sprite && sprite.width && sprite.height) {
            const aspectRatio = sprite.width / sprite.height || 1;
            const maxWidth = heroe
                ? Math.max(36, Math.min(heroe.width * 1.4, 96))
                : 60;
            const maxHeight = heroe
                ? Math.max(heroe.height * 0.35, 18)
                : 24;

            const widthFromHeight = maxHeight * aspectRatio;

            if (widthFromHeight <= maxWidth) {
                width = widthFromHeight;
                height = maxHeight;
            } else {
                width = maxWidth;
                height = maxWidth / aspectRatio;
            }
        }

        if (tier.projectilePath === 'images/proyectil-5.png') {
            width *= 1.2;
            height *= 1.2;
        } else if (tier.projectilePath === 'images/proyectil-6.png') {
            width *= 1.35;
            height *= 1.35;
        }

        return { sprite, width, height, etapa: index };
    }

    const enemyDefinitions = {
        enemigo1: {
            id: 'enemigo1',
            name: 'Enemigo 1',
            spritePath: 'images/Enemigo 1.png',
            baseHealth: 5,
            healthByDifficulty: {
                facil: 5,
                intermedio: 5
            },
            speedRange: { min: 0.4, max: 0.55 },
            speedLabel: 'Lento',
            points: 10
        },
        enemigo2: {
            id: 'enemigo2',
            name: 'Enemigo 2',
            spritePath: 'images/Enemigo 2.png',
            baseHealth: 8,
            healthByDifficulty: {
                facil: 8,
                intermedio: 10,
                dificil: 10
            },
            speedRange: { min: 0.6, max: 0.75 },
            speedLabel: 'Medio-Lento',
            points: 20
        },
        enemigo3: {
            id: 'enemigo3',
            name: 'Enemigo 3',
            spritePath: 'images/Enemigo 3.png',
            baseHealth: 12,
            healthByDifficulty: {
                facil: 12,
                intermedio: 18,
                dificil: 18
            },
            speedRange: { min: 0.45, max: 0.6 },
            speedLabel: 'Lento',
            points: 25
        },
        enemigo4: {
            id: 'enemigo4',
            name: 'Enemigo 4',
            spritePath: 'images/Enemigo 4.png',
            baseHealth: 18,
            healthByDifficulty: {
                facil: 18,
                intermedio: 25,
                dificil: 25
            },
            speedRange: { min: 0.9, max: 1.1 },
            speedLabel: 'Media',
            points: 40
        },
        enemigo5: {
            id: 'enemigo5',
            name: 'Enemigo 5',
            spritePath: 'images/Enemigo 5.png',
            baseHealth: 40,
            healthByDifficulty: {
                intermedio: 40,
                dificil: 40
            },
            speedRange: { min: 1.8, max: 2.2 },
            speedLabel: 'Muy Rápido',
            points: 45
        },
        enemigo6: {
            id: 'enemigo6',
            name: 'Enemigo 6',
            spritePath: 'images/Enemigo 6.png',
            baseHealth: 65,
            healthByDifficulty: {
                dificil: 65
            },
            speedRange: { min: 1.4, max: 1.7 },
            speedLabel: 'Rápido',
            points: 60
        }
    };

    const sprites = {
        heroe: null,
        castillo: null,
        enemigos: {},
        auras: {},
        proyectiles: {}
    };

    let enemyProgressionState = [];
    let unlockedEnemyIds = [];
    let enemyKillCounts = {};

    function removeEnemyFromUnlocked(enemyId) {
        unlockedEnemyIds = unlockedEnemyIds.filter(id => id !== enemyId);
    }

    const enemyProgressionRules = {
        facil: [
            { id: 'enemigo1' },
            { id: 'enemigo2', requires: { id: 'enemigo1', kills: 6 } },
            { id: 'enemigo3', requires: { id: 'enemigo2', kills: 6 } },
            { id: 'enemigo4', requires: { id: 'enemigo3', kills: 8 } }
        ],
        intermedio: [
            { id: 'enemigo1' },
            { id: 'enemigo2', requires: { id: 'enemigo1', kills: 6 } },
            { id: 'enemigo3', requires: { id: 'enemigo2', kills: 6 } },
            {
                id: 'enemigo4',
                requires: { id: 'enemigo3', kills: 8 },
                onUnlock: () => removeEnemyFromUnlocked('enemigo1')
            },
            { id: 'enemigo5', requires: { id: 'enemigo4', kills: 8 } }
        ],
        dificil: [
            { id: 'enemigo2' },
            { id: 'enemigo3', requires: { id: 'enemigo2', kills: 6 } },
            { id: 'enemigo4', requires: { id: 'enemigo3', kills: 6 } },
            { id: 'enemigo5', requires: { id: 'enemigo4', kills: 8 } },
            { id: 'enemigo6', requires: { id: 'enemigo5', kills: 10 } }
        ]
    };

    const difficultySettings = {
        facil: {
            label: 'Fácil',
            castleLives: 10,
            targetScore: 1000,
            spawnRate: 3500,
            minSpawnRate: 1200,
            enemy: {
                healthMultiplier: 1,
                speedMultiplier: 0.85
            }
        },
        intermedio: {
            label: 'Intermedio',
            castleLives: 5,
            targetScore: 2000,
            spawnRate: 3000,
            minSpawnRate: 700,
            enemy: {
                healthMultiplier: 1,
                speedMultiplier: 1,
                lateThreshold: 0.7,
                lateHealthMultiplier: 1.25,
                lateSpeedMultiplier: 1.1
            }
        },
        dificil: {
            label: 'Difícil',
            castleLives: 3,
            targetScore: 5000,
            spawnRate: 2600,
            minSpawnRate: 450,
            enemy: {
                healthMultiplier: 1,
                speedMultiplier: 1.25
            }
        }
    };

    async function main() {
        // Carga los verbos del archivo JSON
        await cargarVerbos();
        // Carga los sprites del juego
        await cargarSprites();
        // Configura los listeners de la pantalla de selección
        setupSelectionListeners();
    }

    // Carga los verbos desde el archivo JSON
    async function cargarVerbos() {
        try {
            const response = await fetch('verbs.json');
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            masterVerbos = await response.json();
        } catch (error) {
            console.error("Error al cargar el archivo de verbos:", error);
            selectionErrorEl.textContent = "Error al cargar los verbos. Refresca la página.";
        }
    }

    async function cargarSprites() {
        const entradas = Object.entries(spritePaths).map(([clave, ruta]) =>
            cargarSprite(ruta)
                .then(img => {
                    sprites[clave] = img;
                })
                .catch(error => {
                    console.error(error);
                    sprites[clave] = null;
                })
        );

        const entradasEnemigos = Object.values(enemyDefinitions).map(definicion =>
            cargarSprite(definicion.spritePath)
                .then(img => {
                    sprites.enemigos[definicion.id] = img;
                })
                .catch(error => {
                    console.error(error);
                    sprites.enemigos[definicion.id] = null;
                })
        );

        const auraPaths = [...new Set(ATTACK_VISUAL_TIERS
            .map(tier => tier.auraPath)
            .filter(Boolean))];

        const projectilePaths = [...new Set(ATTACK_VISUAL_TIERS
            .map(tier => tier.projectilePath)
            .filter(Boolean))];

        const entradasAuras = auraPaths.map(ruta =>
            cargarSprite(ruta)
                .then(img => {
                    sprites.auras[ruta] = img;
                })
                .catch(error => {
                    console.error(error);
                    sprites.auras[ruta] = null;
                })
        );

        const entradasProyectiles = projectilePaths.map(ruta =>
            cargarSprite(ruta)
                .then(img => {
                    sprites.proyectiles[ruta] = img;
                })
                .catch(error => {
                    console.error(error);
                    sprites.proyectiles[ruta] = null;
                })
        );

        await Promise.all([
            ...entradas,
            ...entradasEnemigos,
            ...entradasAuras,
            ...entradasProyectiles
        ]);
    }

    function cargarSprite(ruta) {
        return new Promise((resolve, reject) => {
            const imagen = new Image();
            imagen.onload = () => resolve(imagen);
            imagen.onerror = () => reject(new Error(`No se pudo cargar la imagen ${ruta}`));
            imagen.src = ruta;
        });
    }

    // --- 4. LÓGICA DE SELECCIÓN ---

    function actualizarEstadoBotonInicio() {
        startButton.disabled = !(selectedVerbType && selectedDifficulty && selectedMode);
    }

    function establecerModo(modo, { auto = false } = {}) {
        selectedMode = modo;

        modeButtons.forEach(btn => {
            btn.classList.toggle('btn-selected', btn.dataset.mode === modo);
        });

        if (modo) {
            difficultySelectionDiv.classList.remove('hidden');
        } else {
            difficultySelectionDiv.classList.add('hidden');
        }

        if (!modo) {
            selectedDifficulty = null;
            difficultyButtons.forEach(btn => btn.classList.remove('btn-selected'));
        }

        if (!auto) {
            selectionErrorEl.textContent = '';
        }

        actualizarEstadoBotonInicio();
    }

    function actualizarDisponibilidadModos() {
        const requiereSoloEscritura = selectedVerbType === 'irregular' || selectedVerbType === 'regular-irregular';

        selectionErrorEl.textContent = '';

        if (choiceModeButton) {
            choiceModeButton.disabled = !!requiereSoloEscritura;
            if (requiereSoloEscritura) {
                choiceModeButton.classList.remove('btn-selected');
                choiceModeButton.setAttribute('aria-disabled', 'true');
            } else {
                choiceModeButton.removeAttribute('aria-disabled');
            }
        }

        if (writeModeButton) {
            writeModeButton.disabled = false;
        }

        if (modeRestrictionMessage) {
            modeRestrictionMessage.textContent = requiereSoloEscritura
                ? 'Write Mode is required for irregular verbs / El modo escritura es obligatorio con verbos irregulares.'
                : '';
        }

        if (requiereSoloEscritura) {
            establecerModo('write', { auto: true });
        } else {
            establecerModo(null, { auto: true });
        }
    }

    function setupSelectionListeners() {
        // Listeners para botones de TIEMPO
        tenseButtons.forEach(button => {
            button.addEventListener('click', () => {
                selectedTense = button.dataset.tense;
                selectedTenseLabel = button.dataset.label || button.textContent.trim();
                // Resaltar botón
                tenseButtons.forEach(btn => btn.classList.remove('btn-selected'));
                button.classList.add('btn-selected');
                // Resetear selecciones dependientes y mostrar el siguiente paso
                selectedVerbType = null;
                selectedMode = null;
                selectedDifficulty = null;
                typeButtons.forEach(btn => btn.classList.remove('btn-selected'));
                modeButtons.forEach(btn => btn.classList.remove('btn-selected'));
                difficultyButtons.forEach(btn => btn.classList.remove('btn-selected'));
                typeSelectionDiv.classList.remove('hidden');
                modeSelectionDiv.classList.add('hidden');
                difficultySelectionDiv.classList.add('hidden');
                if (choiceModeButton) {
                    choiceModeButton.disabled = false;
                    choiceModeButton.removeAttribute('aria-disabled');
                }
                if (writeModeButton) {
                    writeModeButton.disabled = false;
                }
                if (modeRestrictionMessage) {
                    modeRestrictionMessage.textContent = '';
                }
                selectionErrorEl.textContent = '';
                actualizarEstadoBotonInicio();
            });
        });

        // Listeners para botones de TIPO
        typeButtons.forEach(button => {
            button.addEventListener('click', () => {
                selectedVerbType = button.dataset.type;
                // Resaltar botón
                typeButtons.forEach(btn => btn.classList.remove('btn-selected'));
                button.classList.add('btn-selected');
                selectedMode = null;
                selectedDifficulty = null;
                difficultyButtons.forEach(btn => btn.classList.remove('btn-selected'));
                modeSelectionDiv.classList.remove('hidden');
                selectionErrorEl.textContent = ''; // Limpiar error
                actualizarDisponibilidadModos();
            });
        });

        modeButtons.forEach(button => {
            button.addEventListener('click', () => {
                if (button.disabled) {
                    return;
                }
                selectedDifficulty = null;
                difficultyButtons.forEach(btn => btn.classList.remove('btn-selected'));
                establecerModo(button.dataset.mode);
            });
        });

        // Listeners para botones de DIFICULTAD
        difficultyButtons.forEach(button => {
            button.addEventListener('click', () => {
                selectedDifficulty = button.dataset.difficulty;
                difficultyButtons.forEach(btn => btn.classList.remove('btn-selected'));
                button.classList.add('btn-selected');
                selectionErrorEl.textContent = '';
                actualizarEstadoBotonInicio();
            });
        });

        // Listener para el botón de INICIAR JUEGO
        startButton.addEventListener('click', () => {
            if (!selectedDifficulty) {
                selectionErrorEl.textContent = 'Selecciona una dificultad para comenzar.';
                return;
            }
            if (!selectedMode) {
                selectionErrorEl.textContent = 'Selecciona un modo de juego para comenzar.';
                return;
            }
            // 1. Filtrar la base de datos de verbos
            verbos = masterVerbos.filter(v => v.tense === selectedTense);

            if (selectedVerbType === 'regular') {
                verbos = verbos.filter(v => v.regular === true);
            } else if (selectedVerbType === 'irregular') {
                verbos = verbos.filter(v => v.regular === false);
            }
            // Si es 'regular-irregular', no se necesita más filtro

            if (selectedMode === 'choice') {
                verbos = verbos.filter(v => CHOICE_MODE_VERBS.includes(v.verb));
            }

            // 2. Comprobar si hay verbos
            if (verbos.length === 0) {
                selectionErrorEl.textContent = 'No hay verbos para esta combinación.';
                return;
            }

            // 3. Ocultar overlay y mostrar el juego
            selectionOverlay.style.display = 'none'; // Usar display: none para ocultar
            appContainer.classList.remove('hidden');
            appContainer.style.display = 'flex'; // Asegurar que sea flex

            // 4. Iniciar el juego
            inicializarJuego();
        });
    }

    // --- 5. LÓGICA DEL MINI-JUEGO ---

    function cargarPregunta() {
        if (selectedMode === 'choice') {
            cargarPreguntaChoiceMode();
        } else {
            cargarPreguntaWriteMode();
        }
    }

    function cargarPreguntaWriteMode() {
        // Selecciona un verbo aleatorio de la lista filtrada 'verbos'
        if (!verbos.length) return;
        preguntaActual = verbos[Math.floor(Math.random() * verbos.length)];

        verbEl.textContent = `"${preguntaActual.verb}"`;
        // Mostrar el nombre del tiempo verbal seleccionado por el usuario
        tenseEl.textContent = selectedTenseLabel || selectedTense;
        pronounEl.textContent = preguntaActual.pronoun;

        answerInput.value = '';
        messageEl.textContent = '';
        messageEl.className = '';
        answerInput.focus();
    }

    function cargarPreguntaChoiceMode() {
        if (!choiceCells.length) {
            preguntaActual = {};
            return;
        }
        const disponibles = choiceCells.filter(cell => cell.question);
        if (!disponibles.length) {
            preguntaActual = {};
            return;
        }
        const celdaObjetivo = disponibles[Math.floor(Math.random() * disponibles.length)];
        preguntaActual = { ...celdaObjetivo.question };

        choiceVerbEl.textContent = preguntaActual.verb || '...';
        choicePronounEl.textContent = preguntaActual.pronoun || '...';
        messageEl.textContent = '';
        messageEl.className = '';
    }

    function manejarRespuestaCorrecta() {
        poderAtaque++;
        if (poderAtaque < PODER_ATAQUE_MINIMO) {
            poderAtaque = PODER_ATAQUE_MINIMO;
        }
        if (poderAtaqueMaximo === undefined) {
            poderAtaqueMaximo = PODER_ATAQUE_MINIMO;
        }
        poderAtaqueMaximo = Math.max(poderAtaqueMaximo, poderAtaque);
        messageEl.textContent = '¡CORRECTO! +1 Poder de Ataque';
        messageEl.className = 'text-success';
    }

    function manejarRespuestaIncorrecta() {
        poderAtaque = Math.max(PODER_ATAQUE_MINIMO, poderAtaque - 1);
        messageEl.textContent = 'Incorrecto. -1 Poder de Ataque. Inténtalo de nuevo.';
        messageEl.className = 'text-error';
        setTimeout(() => {
            if (!gameOver) messageEl.textContent = '';
        }, 2000);
    }

    function asignarConjugacionChoice(cellData) {
        if (!cellData) return;
        if (!verbos.length) {
            cellData.question = null;
            cellData.element.textContent = '...';
            return;
        }
        const dato = verbos[Math.floor(Math.random() * verbos.length)];
        cellData.question = { ...dato };
        cellData.element.textContent = cellData.question.answer;
    }

    function manejarSeleccionChoice(cellData) {
        if (gameOver || selectedMode !== 'choice') return;
        if (!cellData || !cellData.question || !preguntaActual || !preguntaActual.answer) return;

        if (
            cellData.question.verb === preguntaActual.verb &&
            cellData.question.answer === preguntaActual.answer
        ) {
            manejarRespuestaCorrecta();
            setTimeout(() => {
                asignarConjugacionChoice(cellData);
                cargarPregunta();
            }, 500);
        } else {
            manejarRespuestaIncorrecta();
        }
    }

    function comprobarRespuesta() {
        if (gameOver || selectedMode !== 'write') return; // No hacer nada si el juego terminó

        const respuestaUsuario = answerInput.value.trim().toLowerCase();
        if (respuestaUsuario === preguntaActual.answer) {
            manejarRespuestaCorrecta();
            // Cargar la siguiente pregunta después de un breve retraso
            setTimeout(cargarPregunta, 500);
        } else {
            manejarRespuestaIncorrecta();
        }
    }

    function configurarMinijuegoPorModo() {
        if (selectedMode === 'choice') {
            writeModeContainer.classList.add('hidden');
            choiceModeContainer.classList.remove('hidden');
            answerInput.blur();
            choiceGrid.innerHTML = '';
            choiceCells = [];
            const totalCeldas = CHOICE_MODE_GRID_SIZES[selectedDifficulty] || 6;
            const columnas = CHOICE_MODE_COLUMNS[selectedDifficulty] || Math.max(1, Math.floor(totalCeldas / 2));
            choiceGrid.style.gridTemplateColumns = `repeat(${columnas}, minmax(0, 1fr))`;
            choiceGrid.style.gridTemplateRows = 'repeat(2, auto)';
            for (let i = 0; i < totalCeldas; i++) {
                const celda = document.createElement('button');
                celda.type = 'button';
                celda.className = 'choice-cell';
                const celdaData = { element: celda, question: null };
                celda.addEventListener('click', () => manejarSeleccionChoice(celdaData));
                choiceGrid.appendChild(celda);
                choiceCells.push(celdaData);
            }
            choiceVerbEl.textContent = '...';
            choicePronounEl.textContent = '...';
            choiceCells.forEach(celdaData => asignarConjugacionChoice(celdaData));
        } else {
            writeModeContainer.classList.remove('hidden');
            choiceModeContainer.classList.add('hidden');
            choiceGrid.innerHTML = '';
            choiceGrid.style.gridTemplateColumns = '';
            choiceGrid.style.gridTemplateRows = '';
            choiceCells = [];
            answerInput.value = '';
            choiceVerbEl.textContent = '...';
            choicePronounEl.textContent = '...';
        }
    }

    // Event Listeners del mini-juego
    submitButton.addEventListener('click', comprobarRespuesta);
    answerInput.addEventListener('keydown', (e) => {
        if (selectedMode !== 'write') {
            return;
        }

        const accent = WRITE_MODE_ACCENT_KEYS[e.key];
        if (!accent) {
            return;
        }

        e.preventDefault();
        const start = answerInput.selectionStart ?? answerInput.value.length;
        const end = answerInput.selectionEnd ?? answerInput.value.length;
        const before = answerInput.value.slice(0, start);
        const after = answerInput.value.slice(end);
        answerInput.value = `${before}${accent}${after}`;
        const newPos = start + accent.length;
        answerInput.setSelectionRange(newPos, newPos);
    });
    answerInput.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
            comprobarRespuesta();
        }
    });

    // --- 6. LÓGICA DEL JUEGO PRINCIPAL ---

    function inicializarJuego() {
        // Ajustar tamaño del canvas
        canvas.width = canvas.clientWidth;
        canvas.height = canvas.clientHeight;

        // Resetear estado
        alturaTerreno = canvas.height * 0.15; // 15% del canvas para el terreno
        dificultadActual = difficultySettings[selectedDifficulty];
        if (!dificultadActual) {
            console.error('No se encontró configuración para la dificultad seleccionada.');
            return;
        }

        vidas = dificultadActual.castleLives;
        puntuacion = 0;
        poderAtaque = PODER_ATAQUE_MINIMO;
        poderAtaqueMaximo = PODER_ATAQUE_MINIMO;
        gameOver = false;
        ultimoSpawn = 0;
        spawnRate = dificultadActual.spawnRate;
        objetivoPuntuacion = dificultadActual.targetScore;
        castillo = null;
        messageEl.textContent = '';
        messageEl.className = '';

        configurarMinijuegoPorModo();

        monstruos = [];
        proyectiles = [];

        inicializarProgresionEnemigos();

        // Crear castillo y héroe
        const heroeSprite = sprites.heroe;
        const heroeAncho = 48;
        const heroeAlto = 64;
        const castilloSprite = sprites.castillo;
        const maxCastleHeight = Math.max(160, canvas.height - alturaTerreno - 60);
        const castleHeight = Math.min(maxCastleHeight, 260);
        const castleWidth = castleHeight; // El sprite es cuadrado
        const castleX = 40;
        const castleY = Math.max(0, canvas.height - alturaTerreno - castleHeight + 20);

        castillo = {
            x: castleX,
            y: castleY,
            width: castleWidth,
            height: castleHeight,
            sprite: castilloSprite,
            vidas: vidas,
            vidasMax: dificultadActual.castleLives
        };

        heroe = {
            x: castleX + castleWidth / 2 - heroeAncho / 2,
            y: canvas.height - alturaTerreno - heroeAlto,
            width: heroeAncho,
            height: heroeAlto,
            sprite: heroeSprite,
            ultimoDisparo: 0,
            cadencia: 1000 // 1 disparo por segundo
        };

        // Ocultar overlay de game over
        gameOverOverlay.classList.add('hidden');
        gameOverOverlay.style.display = 'none'; // Asegurar
        
        // Cargar primera pregunta
        cargarPregunta();
        
        // Iniciar el bucle del juego
        if (gameLoopId) {
            cancelAnimationFrame(gameLoopId);
        }
        gameLoopId = requestAnimationFrame(gameLoop);
    }

    function gameLoop(timestamp) {
        if (gameOver) {
            cancelAnimationFrame(gameLoopId);
            return;
        }

        actualizar(timestamp);
        dibujar();

        gameLoopId = requestAnimationFrame(gameLoop);
    }

    // --- 7. ACTUALIZACIÓN (Update) ---

    function actualizar(timestamp) {
        if (poderAtaqueMaximo === undefined || poderAtaqueMaximo < PODER_ATAQUE_MINIMO) {
            poderAtaqueMaximo = PODER_ATAQUE_MINIMO;
        }

        const poderSegunHistorial = Math.max(PODER_ATAQUE_MINIMO, poderAtaqueMaximo);

        if (poderAtaque < poderSegunHistorial) {
            poderAtaque = poderSegunHistorial;
        }

        poderAtaqueMaximo = Math.max(poderAtaqueMaximo, poderAtaque);

        // 1. Spawneo de monstruos
        if (timestamp - ultimoSpawn > spawnRate) {
            ultimoSpawn = timestamp;
            const minSpawn = dificultadActual ? dificultadActual.minSpawnRate : 500;
            spawnRate = Math.max(minSpawn, spawnRate * 0.99); // Acelera el spawn rate
            crearMonstruo();
        }

        // 2. Disparo automático del héroe
        if (timestamp - heroe.ultimoDisparo > heroe.cadencia) {
            heroe.ultimoDisparo = timestamp;
            crearProyectil();
        }

        // 3. Mover proyectiles
        for (let i = proyectiles.length - 1; i >= 0; i--) {
            let p = proyectiles[i];
            p.x += p.velocidad;
            // Eliminar si sale de la pantalla
            if (p.x > canvas.width) {
                proyectiles.splice(i, 1);
            }
        }

        // 4. Mover monstruos
        for (let i = monstruos.length - 1; i >= 0; i--) {
            let m = monstruos[i];
            m.x -= m.velocidad;

            // Monstruo llega al héroe
            if (m.x < heroe.x + heroe.width) {
                monstruos.splice(i, 1);
                vidas = Math.max(0, vidas - 1);
                if (castillo) {
                    castillo.vidas = vidas;
                }
                if (vidas <= 0) {
                    finalizarJuego('derrota');
                    break;
                }
            }
        }

        if (gameOver) {
            return;
        }

        // 5. Comprobar colisiones (Proyectil vs Monstruo)
        for (let i = proyectiles.length - 1; i >= 0; i--) {
            let p = proyectiles[i];
            for (let j = monstruos.length - 1; j >= 0; j--) {
                let m = monstruos[j];
                
                // Simple colisión AABB
                if (p.x < m.x + m.width &&
                    p.x + p.width > m.x &&
                    p.y < m.y + m.height &&
                    p.y + p.height > m.y)
                {
                    // Colisión detectada
                    proyectiles.splice(i, 1); // Eliminar proyectil
                    m.vida -= p.poder;

                    if (m.vida <= 0) {
                        monstruos.splice(j, 1); // Eliminar monstruo
                        registrarMuerteMonstruo(m);
                        puntuacion += m.puntos;
                        if (objetivoPuntuacion && puntuacion >= objetivoPuntuacion) {
                            finalizarJuego('victoria');
                        }
                    }
                    i--; // El proyectil se ha ido, evitar saltar el siguiente
                    break; // El proyectil solo puede golpear a un monstruo
                }
            }
            if (gameOver) break;
        }

        if (gameOver) {
            return;
        }
    }
    
    function crearProyectil() {
        const poderActual = Math.max(PODER_ATAQUE_MINIMO, poderAtaque);
        const configuracion = obtenerConfiguracionProyectil(poderActual);

        proyectiles.push({
            x: heroe.x + heroe.width,
            y: heroe.y + heroe.height / 2 - configuracion.height / 2,
            width: configuracion.width,
            height: configuracion.height,
            sprite: configuracion.sprite || null,
            velocidad: 8,
            poder: poderActual,
            visualStage: configuracion.etapa
        });
    }

    function crearMonstruo() {
        if (!unlockedEnemyIds.length) {
            intentarDesbloquearEnemigos();
        }

        if (!unlockedEnemyIds.length) {
            return;
        }

        const enemyId = unlockedEnemyIds[Math.floor(Math.random() * unlockedEnemyIds.length)];
        const definicion = enemyDefinitions[enemyId];
        if (!definicion) {
            return;
        }

        const enemyConfig = dificultadActual ? dificultadActual.enemy : {};
        let healthMultiplier = enemyConfig.healthMultiplier ?? 1;
        let speedMultiplier = enemyConfig.speedMultiplier ?? 1;

        if (enemyConfig.lateThreshold && objetivoPuntuacion && puntuacion >= objetivoPuntuacion * enemyConfig.lateThreshold) {
            if (enemyConfig.lateHealthMultiplier) {
                healthMultiplier *= enemyConfig.lateHealthMultiplier;
            }
            if (enemyConfig.lateSpeedMultiplier) {
                speedMultiplier *= enemyConfig.lateSpeedMultiplier;
            }
        }

        const velocidadBase = definicion.speedRange.min + Math.random() * (definicion.speedRange.max - definicion.speedRange.min);
        const velocidad = velocidadBase * speedMultiplier;

        const baseHealth = (
            definicion.healthByDifficulty && selectedDifficulty
                ? definicion.healthByDifficulty[selectedDifficulty]
                : undefined
        ) ?? definicion.baseHealth ?? 1;

        const vida = Math.max(1, Math.round(baseHealth * healthMultiplier));

        const monstruo = {
            x: canvas.width,
            width: 48,
            height: 64,
            puntos: definicion.points,
            velocidad,
            vida,
            vidaMax: vida,
            sprite: sprites.enemigos[enemyId] || null,
            color: '#6c757d',
            typeId: enemyId
        };

        monstruo.y = canvas.height - alturaTerreno - monstruo.height;
        monstruos.push(monstruo);
    }

    function registrarMuerteMonstruo(monstruo) {
        if (!monstruo || !monstruo.typeId) {
            return;
        }

        enemyKillCounts[monstruo.typeId] = (enemyKillCounts[monstruo.typeId] || 0) + 1;
        intentarDesbloquearEnemigos();
    }

    function inicializarProgresionEnemigos() {
        enemyKillCounts = {};
        unlockedEnemyIds = [];

        const reglas = enemyProgressionRules[selectedDifficulty] || [];
        enemyProgressionState = reglas.map(regla => ({
            id: regla.id,
            requires: regla.requires || null,
            unlocked: !regla.requires,
            onUnlock: regla.onUnlock || null
        }));

        enemyProgressionState.forEach(stage => {
            enemyKillCounts[stage.id] = 0;
            if (stage.unlocked) {
                unlockedEnemyIds.push(stage.id);
            }
        });

        if (!unlockedEnemyIds.length && enemyProgressionState.length) {
            enemyProgressionState[0].unlocked = true;
            unlockedEnemyIds.push(enemyProgressionState[0].id);
        }
    }

    function intentarDesbloquearEnemigos() {
        enemyProgressionState.forEach(stage => {
            if (stage.unlocked) {
                return;
            }

            if (stage.requires) {
                const kills = enemyKillCounts[stage.requires.id] || 0;
                if (kills >= stage.requires.kills) {
                    stage.unlocked = true;
                    unlockedEnemyIds.push(stage.id);
                    if (typeof stage.onUnlock === 'function') {
                        stage.onUnlock();
                    }
                }
            } else {
                stage.unlocked = true;
                unlockedEnemyIds.push(stage.id);
            }
        });

        unlockedEnemyIds = [...new Set(unlockedEnemyIds)];
    }

    // --- 8. DIBUJADO (Draw) ---

    function dibujarCastillo() {
        if (!castillo) return;

        if (castillo.sprite) {
            ctx.drawImage(castillo.sprite, castillo.x, castillo.y, castillo.width, castillo.height);
        } else {
            ctx.fillStyle = '#a8a29e';
            ctx.fillRect(castillo.x, castillo.y, castillo.width, castillo.height);
        }

        const barWidth = castillo.width;
        const barHeight = 14;
        const barX = castillo.x;
        const barY = castillo.y - 24;

        ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
        ctx.fillRect(barX, barY, barWidth, barHeight);

        ctx.fillStyle = '#dc2626';
        ctx.fillRect(barX + 2, barY + 2, barWidth - 4, barHeight - 4);

        ctx.fillStyle = '#10b981';
        const vidaProporcion = castillo.vidasMax ? castillo.vidas / castillo.vidasMax : 0;
        ctx.fillRect(barX + 2, barY + 2, (barWidth - 4) * Math.max(0, vidaProporcion), barHeight - 4);

        ctx.strokeStyle = '#1f2937';
        ctx.lineWidth = 2;
        ctx.strokeRect(barX, barY, barWidth, barHeight);
    }

    function dibujarAuraHeroe() {
        if (!heroe) return;

        const auraSprite = obtenerSpriteAura(poderAtaque);
        if (!auraSprite) {
            return;
        }

        const centroX = heroe.x + heroe.width / 2;
        const centroY = heroe.y + heroe.height / 2;

        const baseHeight = heroe.height * 2;
        const aspectRatio = auraSprite.width / auraSprite.height || 1;
        const auraHeight = baseHeight;
        const auraWidth = baseHeight * aspectRatio;

        const drawX = centroX - auraWidth / 2;
        const drawY = centroY - auraHeight / 2;

        ctx.save();
        ctx.globalAlpha = 0.85;
        ctx.drawImage(auraSprite, drawX, drawY, auraWidth, auraHeight);
        ctx.restore();
    }

    function dibujar() {
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Dibujar terreno (césped)
        ctx.fillStyle = '#556B2F'; // Verde oscuro
        ctx.fillRect(0, canvas.height - alturaTerreno, canvas.width, alturaTerreno);
        // Dibujar tierra
        ctx.fillStyle = '#8B4513'; // Marrón
        ctx.fillRect(0, canvas.height - alturaTerreno + 20, canvas.width, alturaTerreno - 20);

        // Dibujar castillo detrás del héroe
        dibujarCastillo();

        // Aura del héroe (detrás del sprite)
        dibujarAuraHeroe();

        // Dibujar héroe
        if (heroe.sprite) {
            ctx.drawImage(heroe.sprite, heroe.x, heroe.y, heroe.width, heroe.height);
        } else {
            ctx.fillStyle = '#007BFF';
            ctx.fillRect(heroe.x, heroe.y, heroe.width, heroe.height);
        }

        // Dibujar proyectiles
        proyectiles.forEach(p => {
            ctx.save();
            if (p.sprite) {
                ctx.drawImage(p.sprite, p.x, p.y, p.width, p.height);
            } else {
                ctx.fillStyle = '#f97316';
                ctx.fillRect(p.x, p.y, p.width, p.height);
            }
            ctx.restore();
        });

        // Dibujar monstruos
        monstruos.forEach(m => {
            if (m.sprite) {
                ctx.drawImage(m.sprite, m.x, m.y, m.width, m.height);
            } else {
                ctx.fillStyle = m.color;
                ctx.fillRect(m.x, m.y, m.width, m.height);
            }
            
            // Barra de vida
            ctx.fillStyle = '#dc3545'; // Rojo (fondo)
            ctx.fillRect(m.x, m.y - 10, m.width, 5);
            ctx.fillStyle = '#28a745'; // Verde (vida)
            ctx.fillRect(m.x, m.y - 10, m.width * (m.vida / m.vidaMax), 5);
        });

        // Dibujar UI (Vidas, Puntuación, Poder, Objetivo)
        ctx.fillStyle = '#000000';
        ctx.font = '24px Inter, sans-serif';
        ctx.textAlign = 'left';
        const vidasMaxCastillo = castillo ? castillo.vidasMax : vidas;
        ctx.fillText(`🏰 Castillo: ${vidas}/${vidasMaxCastillo}`, 20, 40);

        ctx.textAlign = 'center';
        const dificultadTexto = dificultadActual ? ` (${dificultadActual.label})` : '';
        const objetivoTexto = objetivoPuntuacion ? `${objetivoPuntuacion}` : '0';
        ctx.fillText(`🎯 Meta${dificultadTexto}: ${objetivoTexto}`, canvas.width / 2, 40);

        ctx.textAlign = 'right';
        ctx.fillText(`Puntuación: ${puntuacion}`, canvas.width - 20, 40);

        ctx.textAlign = 'center';
        ctx.font = '22px Inter, sans-serif';
        ctx.fillStyle = '#FFD700'; // Dorado
        ctx.fillText(`🔥 Poder de Ataque: ${poderAtaque}`, canvas.width / 2, 72);
    }

    // --- 9. FIN DEL JUEGO Y REINICIO ---
    
    function finalizarJuego(resultado) {
        if (gameOver) return;

        gameOver = true;
        cancelAnimationFrame(gameLoopId); // Detener el bucle
        finalScoreEl.textContent = puntuacion;

        if (resultado === 'victoria') {
            gameOverTitleEl.textContent = '¡VICTORIA!';
            gameOverSubtitleEl.textContent = 'Has defendido el castillo con éxito.';
        } else {
            gameOverTitleEl.textContent = '¡FIN DEL JUEGO!';
            gameOverSubtitleEl.textContent = 'Los monstruos han superado tus defensas.';
        }

        gameOverOverlay.classList.remove('hidden');
        gameOverOverlay.style.display = 'flex'; // Asegurar que sea flex
        messageEl.textContent = resultado === 'victoria' ? '¡El castillo sigue en pie!' : '¡El juego ha terminado!';
        messageEl.className = resultado === 'victoria' ? 'text-success' : 'text-error';
    }

    // Reiniciar el juego
    restartButton.addEventListener('click', () => {
        // Ocultar overlays y el juego
        gameOverOverlay.classList.add('hidden');
        gameOverOverlay.style.display = 'none';
        appContainer.classList.add('hidden');
        appContainer.style.display = 'none';

        // Resetear la selección
        selectedTense = null;
        selectedVerbType = null;
        selectedTenseLabel = '';
        selectedDifficulty = null;
        selectedMode = null;
        dificultadActual = null;
        objetivoPuntuacion = 0;
        castillo = null;
        vidas = 0;
        tenseButtons.forEach(btn => btn.classList.remove('btn-selected'));
        typeButtons.forEach(btn => btn.classList.remove('btn-selected'));
        difficultyButtons.forEach(btn => btn.classList.remove('btn-selected'));
        modeButtons.forEach(btn => btn.classList.remove('btn-selected'));
        difficultySelectionDiv.classList.add('hidden');
        modeSelectionDiv.classList.add('hidden');
        startButton.disabled = true;
        if (choiceModeButton) {
            choiceModeButton.disabled = false;
            choiceModeButton.removeAttribute('aria-disabled');
        }
        if (writeModeButton) {
            writeModeButton.disabled = false;
        }
        if (modeRestrictionMessage) {
            modeRestrictionMessage.textContent = '';
        }
        actualizarEstadoBotonInicio();
        selectionErrorEl.textContent = '';
        messageEl.textContent = '';
        messageEl.className = '';
        choiceGrid.innerHTML = '';
        choiceGrid.style.gridTemplateColumns = '';
        choiceGrid.style.gridTemplateRows = '';
        choiceCells = [];
        choiceVerbEl.textContent = '...';
        choicePronounEl.textContent = '...';
        writeModeContainer.classList.remove('hidden');
        choiceModeContainer.classList.add('hidden');

        // Mostrar la pantalla de selección
        typeSelectionDiv.classList.add('hidden');
        modeSelectionDiv.classList.add('hidden');
        difficultySelectionDiv.classList.add('hidden');
        tenseSelectionDiv.classList.remove('hidden');
        selectionOverlay.style.display = 'flex'; // Mostrar overlay
    });
    
    // --- 10. INICIAR LA APLICACIÓN ---
    main();
});
