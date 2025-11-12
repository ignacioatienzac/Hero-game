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
    const startButton = document.getElementById('start-game-button');
    const selectionErrorEl = document.getElementById('selection-error');
    const gameOverTitleEl = document.querySelector('.game-over-title');
    const gameOverSubtitleEl = document.querySelector('.game-over-subtitle');

    // --- 2. VARIABLES DE ESTADO DEL JUEGO ---

    // Variables de selección
    let selectedTense = null;
    let selectedVerbType = null;
    let masterVerbos = []; // Aquí se cargarán los verbos del JSON
    let verbos = []; // Lista filtrada para la partida actual
    let preguntaActual = {};
    let selectedDifficulty = null;

    // Variables del juego principal
    let heroe;
    let monstruos = [];
    let proyectiles = [];
    let vidas;
    let puntuacion;
    let poderAtaque;
    let gameOver;
    let ultimoSpawn;
    let spawnRate; // en ms
    let alturaTerreno;
    let gameLoopId; // Para poder detener el bucle del juego
    let castillo;
    let objetivoPuntuacion;
    let dificultadActual;

    // --- 3. FUNCIÓN PRINCIPAL DE INICIO ---

    const spritePaths = {
        heroe: 'images/Heroe.png',
        castillo: 'images/Castillo.png'
    };

    const enemyDefinitions = {
        enemigo1: {
            id: 'enemigo1',
            name: 'Enemigo 1',
            spritePath: 'images/Enemigo 1.png',
            baseHealth: 2,
            speedRange: { min: 0.45, max: 0.65 },
            points: 10
        },
        enemigo2: {
            id: 'enemigo2',
            name: 'Enemigo 2',
            spritePath: 'images/Enemigo 2.png',
            baseHealth: 4,
            speedRange: { min: 0.65, max: 0.85 },
            points: 20
        },
        enemigo3: {
            id: 'enemigo3',
            name: 'Enemigo 3',
            spritePath: 'images/Enemigo 3.png',
            baseHealth: 6,
            speedRange: { min: 0.5, max: 0.7 },
            points: 25
        },
        enemigo4: {
            id: 'enemigo4',
            name: 'Enemigo 4',
            spritePath: 'images/Enemigo 4.png',
            baseHealth: 8,
            speedRange: { min: 0.9, max: 1.1 },
            points: 40
        },
        enemigo5: {
            id: 'enemigo5',
            name: 'Enemigo 5',
            spritePath: 'images/Enemigo 5.png',
            baseHealth: 10,
            speedRange: { min: 1.6, max: 2.0 },
            points: 45
        },
        enemigo6: {
            id: 'enemigo6',
            name: 'Enemigo 6',
            spritePath: 'images/Enemigo 6.png',
            baseHealth: 15,
            speedRange: { min: 1.3, max: 1.6 },
            points: 60
        }
    };

    const sprites = {
        heroe: null,
        castillo: null,
        enemigos: {}
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
                healthMultiplier: 0.75,
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
                healthMultiplier: 1.35,
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

        await Promise.all([...entradas, ...entradasEnemigos]);
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
        startButton.disabled = !(selectedVerbType && selectedDifficulty);
    }

    function setupSelectionListeners() {
        // Listeners para botones de TIEMPO
        tenseButtons.forEach(button => {
            button.addEventListener('click', () => {
                selectedTense = button.dataset.tense;
                // Resaltar botón
                tenseButtons.forEach(btn => btn.classList.remove('btn-selected'));
                button.classList.add('btn-selected');
                // Mostrar siguiente paso
                tenseSelectionDiv.classList.add('hidden');
                typeSelectionDiv.classList.remove('hidden');
            });
        });

        // Listeners para botones de TIPO
        typeButtons.forEach(button => {
            button.addEventListener('click', () => {
                selectedVerbType = button.dataset.type;
                // Resaltar botón
                typeButtons.forEach(btn => btn.classList.remove('btn-selected'));
                button.classList.add('btn-selected');
                // Mostrar dificultad
                difficultySelectionDiv.classList.remove('hidden');
                selectionErrorEl.textContent = ''; // Limpiar error
                actualizarEstadoBotonInicio();
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
            // 1. Filtrar la base de datos de verbos
            verbos = masterVerbos.filter(v => v.tense === selectedTense);

            if (selectedVerbType === 'regular') {
                verbos = verbos.filter(v => v.regular === true);
            }
            // Si es 'regular-irregular', no se necesita más filtro

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
        // Selecciona un verbo aleatorio de la lista filtrada 'verbos'
        preguntaActual = verbos[Math.floor(Math.random() * verbos.length)];
        
        verbEl.textContent = `"${preguntaActual.verb}"`;
        // Mostrar el nombre del tiempo verbal seleccionado por el usuario
        tenseEl.textContent = selectedTense; 
        pronounEl.textContent = preguntaActual.pronoun;
        
        answerInput.value = '';
        messageEl.textContent = '';
        messageEl.className = '';
        answerInput.focus();
    }

    function comprobarRespuesta() {
        if (gameOver) return; // No hacer nada si el juego terminó

        const respuestaUsuario = answerInput.value.trim().toLowerCase();
        if (respuestaUsuario === preguntaActual.answer) {
            // ¡Correcto! Aumentar poder
            poderAtaque++;
            messageEl.textContent = '¡CORRECTO! +1 Poder de Ataque';
            messageEl.className = 'text-success';
            // Cargar la siguiente pregunta después de un breve retraso
            setTimeout(cargarPregunta, 500); 
        } else {
            // Incorrecto
            messageEl.textContent = 'Incorrecto. Inténtalo de nuevo.';
            messageEl.className = 'text-error';
            // Limpiar mensaje después de 2 segundos
            setTimeout(() => { 
                if (!gameOver) messageEl.textContent = ''; 
            }, 2000);
        }
    }

    // Event Listeners del mini-juego
    submitButton.addEventListener('click', comprobarRespuesta);
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
        poderAtaque = 1;
        gameOver = false;
        ultimoSpawn = 0;
        spawnRate = dificultadActual.spawnRate;
        objetivoPuntuacion = dificultadActual.targetScore;
        castillo = null;
        messageEl.textContent = '';
        messageEl.className = '';

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
        proyectiles.push({
            x: heroe.x + heroe.width,
            y: heroe.y + heroe.height / 2 - 5, // Centrado
            width: 15,
            height: 10,
            color: `rgba(255, 200, 0, ${0.5 + poderAtaque * 0.1})`, // Más poder = más brillante
            velocidad: 8,
            poder: poderAtaque
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
        const vida = Math.max(1, Math.round(definicion.baseHealth * healthMultiplier));

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

        // Dibujar héroe
        if (heroe.sprite) {
            ctx.drawImage(heroe.sprite, heroe.x, heroe.y, heroe.width, heroe.height);
        } else {
            ctx.fillStyle = '#007BFF';
            ctx.fillRect(heroe.x, heroe.y, heroe.width, heroe.height);
        }

        // Dibujar proyectiles
        proyectiles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.strokeStyle = '#FFFF00'; // Borde amarillo
            ctx.strokeRect(p.x, p.y, p.width, p.height);
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
        selectedDifficulty = null;
        dificultadActual = null;
        objetivoPuntuacion = 0;
        castillo = null;
        vidas = 0;
        tenseButtons.forEach(btn => btn.classList.remove('btn-selected'));
        typeButtons.forEach(btn => btn.classList.remove('btn-selected'));
        difficultyButtons.forEach(btn => btn.classList.remove('btn-selected'));
        difficultySelectionDiv.classList.add('hidden');
        startButton.disabled = true;
        actualizarEstadoBotonInicio();
        selectionErrorEl.textContent = '';
        messageEl.textContent = '';
        messageEl.className = '';

        // Mostrar la pantalla de selección
        typeSelectionDiv.classList.add('hidden');
        tenseSelectionDiv.classList.remove('hidden');
        selectionOverlay.style.display = 'flex'; // Mostrar overlay
    });
    
    // --- 10. INICIAR LA APLICACIÓN ---
    main();
});
