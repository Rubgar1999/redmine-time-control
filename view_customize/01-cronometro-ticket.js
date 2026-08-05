// Cronómetro por ticket.
//
// Agrega un botón Iniciar/Detener en la barra contextual del issue. El inicio
// se persiste en localStorage, así que sobrevive a recargas y navegación. Al
// detenerlo redirige al alta de imputación con las horas ya calculadas y el
// campo TimeTracker marcado, para poder distinguir después las horas medidas
// con cronómetro de las cargadas a mano.
//
// Tope de 24 h: si se dejó corriendo, se cierra en 24 h en lugar de imputar
// un número absurdo. Bloquea además tener dos cronómetros activos a la vez.
//
// Ajustar CUSTOM_FIELD_ID al id del campo personalizado booleano TimeTracker.
// path_pattern: /issues/[0-9]+    insertion_position: html_bottom

$(document).ready(function() {
    // 1. Obtener el ID del ticket actual de la URL
    var issueMatch = window.location.pathname.match(/\/issues\/(\d+)/);
    if (!issueMatch) return;
    var issueId = issueMatch[1];
    
    // 2. Variables para el almacenamiento y estado
    var storageKey = 'redmine_timer_issue_' + issueId;
    var startTime = localStorage.getItem(storageKey);
    var timerInterval;
    
    // Límite de 24 horas (en milisegundos)
    var maxTimeMs = 24 * 60 * 60 * 1000; 

    // 3. Crear el botón con el estilo corporativo
    var $btn = $('<a href="#" class="icon icon-time" style="background-color: #2c6291; color: white; padding: 5px 12px; border-radius: 6px; font-weight: bold; margin-right: 10px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); transition: all 0.2s;"></a>');

    // 4. Función para detener y redirigir (MODIFICADA)
    function stopTimerAndRedirect(diffMs) {
        clearInterval(timerInterval);
        var hours = (diffMs / (1000 * 60 * 60)).toFixed(2);
        
        localStorage.removeItem(storageKey);
        
        // INYECTAR EL ID DEL CAMPO PERSONALIZADO AQUÍ
        var CUSTOM_FIELD_ID = '137'; // id del campo booleano "TimeTracker"
        
        window.location.href = '/issues/' + issueId + '/time_entries/new?time_entry[hours]=' + hours + '&time_entry[custom_field_values][' + CUSTOM_FIELD_ID + ']=1';
    }

    // 5. Función para actualizar el cronómetro visualmente
    function updateTimer() {
        if (!startTime) return;
        var diffMs = Date.now() - parseInt(startTime);

        if (diffMs >= maxTimeMs) {
            stopTimerAndRedirect(maxTimeMs);
            return;
        }

        var diff = Math.floor(diffMs / 1000);
        var h = Math.floor(diff / 3600).toString().padStart(2, '0');
        var m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
        var s = (diff % 60).toString().padStart(2, '0');
        $btn.html('⏹ Detener (' + h + ':' + m + ':' + s + ')').css('background-color', '#df8c17');
    }

    if (startTime) {
        updateTimer();
        timerInterval = setInterval(updateTimer, 1000);
    } else {
        $btn.html('▶ Iniciar Temporizador').css('background-color', '#2c6291');
    }

    // 6. Lógica de clics con bloqueo de múltiples temporizadores
    $btn.click(function(e) {
        e.preventDefault();
        
        if (startTime) {
            // DETENER
            var diffMs = Date.now() - parseInt(startTime);
            if (diffMs > maxTimeMs) diffMs = maxTimeMs;
            stopTimerAndRedirect(diffMs);
        } else {
            // INICIAR: Primero comprobar si hay otro temporizador activo en cualquier ticket
            var existingTimerId = null;
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf('redmine_timer_issue_') === 0) {
                    existingTimerId = key.replace('redmine_timer_issue_', '');
                    break; // Encontramos uno, detenemos la búsqueda
                }
            }

            // Si hay uno activo y NO es el ticket actual, bloquear y avisar
            if (existingTimerId && existingTimerId !== issueId) {
                alert('⚠️ Ya tienes un temporizador activo en el Ticket #' + existingTimerId + '.\n\nPor favor, detenlo haciendo clic en el indicador de la barra superior antes de iniciar uno nuevo.');
                return; // Cortar la ejecución aquí, no iniciar el temporizador
            }

            // Si pasa la validación, iniciar normalmente
            startTime = Date.now();
            localStorage.setItem(storageKey, startTime);
            updateTimer();
            timerInterval = setInterval(updateTimer, 1000);
        }
    });

    // 7. Insertar el botón en la interfaz
    $('#content .contextual').first().prepend($btn);
});
