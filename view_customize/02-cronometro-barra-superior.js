// Indicador global del cronómetro.
//
// Lee los cronómetros activos de localStorage y los muestra como badge junto
// al avatar, actualizado cada segundo, de modo que el usuario no pierda de
// vista que está midiendo aunque navegue fuera del ticket. El badge enlaza de
// vuelta al issue. Al cerrar sesión se limpian las claves.
//
// path_pattern: .*    insertion_position: html_bottom

$(document).ready(function() {
    // 1. Contenedor anclado a la cuenta
    var $accountArea = $('#account');
    var $globalContainer = $('<div id="rtc-top-timers" style="display: inline-block; vertical-align: middle; margin-right: 15px;"></div>');
    
    if ($accountArea.length) {
        $accountArea.prepend($globalContainer);
    } else {
        $('#top-menu').prepend($globalContainer);
    }

    var maxTimeMs = 24 * 60 * 60 * 1000; 

    function renderGlobalTimers() {
        var activeTimers = [];

        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf('redmine_timer_issue_') === 0) {
                var issueId = key.replace('redmine_timer_issue_', '');
                var startTime = localStorage.getItem(key);
                activeTimers.push({ id: issueId, start: parseInt(startTime) });
            }
        }

        $globalContainer.empty();

        if (activeTimers.length === 0) return;

        activeTimers.forEach(function(timer) {
            var diffMs = Date.now() - timer.start;
            if (diffMs > maxTimeMs) diffMs = maxTimeMs;

            var diff = Math.floor(diffMs / 1000);
            var h = Math.floor(diff / 3600).toString().padStart(2, '0');
            var m = Math.floor((diff % 3600) / 60).toString().padStart(2, '0');
            var s = (diff % 60).toString().padStart(2, '0');

            // Diseño pequeño (Mini)
            var $badge = $('<a href="/issues/' + timer.id + '" style="background-color: #ffffff; color: #2c6291; padding: 1px 6px; font-weight: bold; font-size: 9px; text-decoration: none; display: inline-flex; align-items: center; gap: 5px; cursor: pointer; height: 16px; line-height: 16px; vertical-align: middle;">' +
                '<span style="text-transform: uppercase;">⏱ TICKET #' + timer.id + '</span>' +
                '<span style="color: #df8c17; font-weight: 800;">' + h + ':' + m + ':' + s + '</span>' +
            '</a>');

            $badge.hover(
                function() { $(this).css('background-color', '#f5f5f5'); },
                function() { $(this).css('background-color', '#ffffff'); }
            );

            $globalContainer.append($badge);
        });
    }

    renderGlobalTimers();
    setInterval(renderGlobalTimers, 1000);

    // === NUEVO: LIMPIAR AL CERRAR SESIÓN ===
    // Detectar clic en el enlace de "Cerrar sesión" / "Salir"
    $('a.logout, a[href*="/logout"]').click(function() {
        var keysToRemove = [];
        
        // Recolectar todas las memorias de temporizadores
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (key && key.indexOf('redmine_timer_issue_') === 0) {
                keysToRemove.push(key);
            }
        }
        
        // Eliminarlas por completo
        keysToRemove.forEach(function(k) {
            localStorage.removeItem(k);
        });
    });
});
