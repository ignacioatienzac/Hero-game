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
    const startButton = document.getElementById('start-game-button');
    const selectionErrorEl = document.getElementById('selection-error');

    // --- 2. VARIABLES DE ESTADO DEL JUEGO ---

    // Variables de selección
    let selectedTense = null;
    let selectedVerbType = null;
    let masterVerbos = []; // Aquí se cargarán los verbos del JSON
    let verbos = []; // Lista filtrada para la partida actual
    let preguntaActual = {};

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

    // --- 3. FUNCIÓN PRINCIPAL DE INICIO ---

    async function main() {
        // Carga los verbos del archivo JSON
        await cargarVerbos();
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

    // --- 4. LÓGICA DE SELECCIÓN ---

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
                // Habilitar botón de inicio
                startButton.disabled = false;
                selectionErrorEl.textContent = ''; // Limpiar error
            });
        });

        // Listener para el botón de INICIAR JUEGO
        startButton.addEventListener('click', () => {
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
        vidas = 10;
        puntuacion = 0;
        poderAtaque = 1;
        gameOver = false;
        ultimoSpawn = 0;
        spawnRate = 3000; // 3 segundos

        monstruos = [];
        proyectiles = [];

        // Crear al héroe
        heroe = {
            x: 50,
            y: canvas.height - alturaTerreno - 60, // 60 de altura
            width: 40,
            height: 60,
            color: '#007BFF', // Azul
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
            spawnRate = Math.max(500, spawnRate * 0.99); // Acelera el spawn rate
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
                vidas--;
                if (vidas <= 0) {
                    terminarJuego();
                }
            }
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
                    }
                    i--; // El proyectil se ha ido, evitar saltar el siguiente
                    break; // El proyectil solo puede golpear a un monstruo
                }
            }
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
            width: 40,
            height: 60,
            puntos: 0
        };

        // Escalar la vida máxima según el poder de ataque
        const vidaBaseZombie = 2 + Math.floor(poderAtaque / 2);
        const vidaBaseLobo = 4 + Math.floor(poderAtaque / 1);

        if (tipo < 0.6) { // 60% Zombie (lento, poca vida)
            monstruo.color = '#28a745'; // Verde
            monstruo.velocidad = 0.5 + Math.random() * 0.5; // Lento
            monstruo.vida = vidaBaseZombie;
            monstruo.vidaMax = vidaBaseZombie;
            monstruo.puntos = 10;
        } else { // 40% Hombre Lobo (rápido, más vida)
            monstruo.color = '#6c757d'; // Gris
            monstruo.velocidad = 1 + Math.random() * 1; // Rápido
            monstruo.vida = vidaBaseLobo;
            monstruo.vidaMax = vidaBaseLobo;
            monstruo.puntos = 25;
        }
        
        monstruo.y = canvas.height - alturaTerreno - monstruo.height;
        monstruos.push(monstruo);
    }

    // --- 8. DIBUJADO (Draw) ---

    function dibujar() {
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Dibujar terreno (césped)
        ctx.fillStyle = '#556B2F'; // Verde oscuro
        ctx.fillRect(0, canvas.height - alturaTerreno, canvas.width, alturaTerreno);
        // Dibujar tierra
        ctx.fillStyle = '#8B4513'; // Marrón
        ctx.fillRect(0, canvas.height - alturaTerreno + 20, canvas.width, alturaTerreno - 20);

        // Dibujar héroe
        ctx.fillStyle = heroe.color;
        ctx.fillRect(heroe.x, heroe.y, heroe.width, heroe.height);
        // "Cañón" del héroe
        ctx.fillStyle = '#333';
        ctx.fillRect(heroe.x + heroe.width - 10, heroe.y + 20, 20, 10);

        // Dibujar proyectiles
        proyectiles.forEach(p => {
            ctx.fillStyle = p.color;
            ctx.fillRect(p.x, p.y, p.width, p.height);
            ctx.strokeStyle = '#FFFF00'; // Borde amarillo
            ctx.strokeRect(p.x, p.y, p.width, p.height);
        });

        // Dibujar monstruos
        monstruos.forEach(m => {
            ctx.fillStyle = m.color;
            ctx.fillRect(m.x, m.y, m.width, m.height);
            
            // Barra de vida
            ctx.fillStyle = '#dc3545'; // Rojo (fondo)
            ctx.fillRect(m.x, m.y - 10, m.width, 5);
            ctx.fillStyle = '#28a745'; // Verde (vida)
            ctx.fillRect(m.x, m.y - 10, m.width * (m.vida / m.vidaMax), 5);
        });

        // Dibujar UI (Vidas, Puntuación, Poder)
        ctx.fillStyle = '#000000';
        ctx.font = '24px Inter, sans-serif';
        ctx.textAlign = 'left';
        ctx.fillText(`❤️ Vidas: ${vidas}`, 20, 40);
        ctx.textAlign = 'right';
        ctx.fillText(`Puntuación: ${puntuacion}`, canvas.width - 20, 40);
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FFD700'; // Dorado
        ctx.fillText(`🔥 Poder de Ataque: ${poderAtaque}`, canvas.width / 2, 40);
    }

    // --- 9. FIN DEL JUEGO Y REINICIO ---
    
    function terminarJuego() {
        gameOver = true;
        cancelAnimationFrame(gameLoopId); // Detener el bucle
        finalScoreEl.textContent = puntuacion;
        gameOverOverlay.classList.remove('hidden');
        gameOverOverlay.style.display = 'flex'; // Asegurar que sea flex
        messageEl.textContent = '¡El juego ha terminado!';
        messageEl.className = 'text-error';
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
        tenseButtons.forEach(btn => btn.classList.remove('btn-selected'));
        typeButtons.forEach(btn => btn.classList.remove('btn-selected'));
        startButton.disabled = true;
        selectionErrorEl.textContent = '';
        
        // Mostrar la pantalla de selección
        typeSelectionDiv.classList.add('hidden');
        tenseSelectionDiv.classList.remove('hidden');
        selectionOverlay.style.display = 'flex'; // Mostrar overlay
    });
    
    // --- 10. INICIAR LA APLICACIÓN ---
    main();
});
