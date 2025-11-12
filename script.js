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
        heroe: 'assets/hero.svg',
        zombie: 'assets/zombie.svg',
        werewolf: 'assets/werewolf.svg',
        castillo: 'assets/castle.svg'
    };

    const sprites = {};

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
        const entradas = Object.entries(spritePaths);
        await Promise.all(entradas.map(([clave, ruta]) => cargarSprite(ruta)
            .then(img => {
                sprites[clave] = img;
            })
            .catch(error => {
                console.error(error);
                sprites[clave] = null;
            })
        ));
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
        const tipo = Math.random();
        let monstruo = {
            x: canvas.width,
            width: 48,
            height: 64,
            puntos: 0
        };

        // Configuración según dificultad
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

        // Escalar la vida máxima según el poder de ataque y dificultad
        const vidaBaseZombie = Math.max(1, Math.round((2 + Math.floor(poderAtaque / 2)) * healthMultiplier));
        const vidaBaseLobo = Math.max(1, Math.round((4 + Math.floor(poderAtaque)) * healthMultiplier));

        if (tipo < 0.6) { // 60% Zombie (lento, poca vida)
            monstruo.color = '#28a745'; // Verde
            monstruo.velocidad = (0.5 + Math.random() * 0.5) * speedMultiplier; // Lento
            monstruo.vida = vidaBaseZombie;
            monstruo.vidaMax = vidaBaseZombie;
            monstruo.puntos = 10;
            monstruo.sprite = sprites.zombie;
        } else { // 40% Hombre Lobo (rápido, más vida)
            monstruo.color = '#6c757d'; // Gris
            monstruo.velocidad = (1 + Math.random() * 1) * speedMultiplier; // Rápido
            monstruo.vida = vidaBaseLobo;
            monstruo.vidaMax = vidaBaseLobo;
            monstruo.puntos = 25;
            monstruo.sprite = sprites.werewolf;
        }

        monstruo.y = canvas.height - alturaTerreno - monstruo.height;
        monstruos.push(monstruo);
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
