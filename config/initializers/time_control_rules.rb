# config/initializers/time_control_rules.rb
# encoding: utf-8
#
# Reglas de control de imputación de horas para Redmine.
# Ver README.md para el detalle de cada regla y su justificación.
#
# Se implementa como initializer y no como plugin a propósito: son reglas de
# negocio de una instalación concreta, no funcionalidad reutilizable, y así no
# hay que mantener un plugin en paralelo al ciclo de actualizaciones de Redmine.

module TimeControl
  # Zona horaria usada para los sellos de tiempo en los comentarios generados.
  TIMEZONE = 'America/Asuncion'.freeze

  # Campo personalizado de tipo lista que define los periodos abiertos.
  #   - description      => días de gracia hacia atrás (entero)
  #   - possible_values  => meses habilitados en formato YYYYMM
  PERIODS_FIELD = 'V_PERIODOS'.freeze

  # Días de gracia si el campo no existe o su description no es un entero.
  DEFAULT_GRACE_DAYS = 2

  # Tope de horas por registro individual.
  MAX_HOURS_PER_ENTRY = 9.0

  # Grupo cuyos miembros pueden modificar las horas estimadas de una petición.
  ESTIMATED_HOURS_ADMIN_GROUP = 'ARM_TIME_ADMIN'.freeze

  # Ventana por defecto (en días) del filtro de la vista Tiempo Dedicado.
  DEFAULT_SPENT_ON_WINDOW_DAYS = 60
end

Rails.application.config.to_prepare do

  # Se resuelven las clases como texto para evitar conflictos de inicio en Zeitwerk
  time_entry_klass = "TimeEntry".safe_constantize
  timelog_controller_klass = "TimelogController".safe_constantize

  # =========================================================================
  # 1. Modificaciones al Modelo TimeEntry (Fumarizacion de Reglas)
  # =========================================================================
  if time_entry_klass
    time_entry_klass.class_eval do
      unless method_defined?(:validar_limite_de_horas_estimadas)

        attr_accessor :guardado_tarde

        # Validaciones Generales
        validate :validar_limite_de_horas_estimadas
        validate :validar_maximo_nueve_horas
        validate :validar_rango_fechas_peticion
        
        # Validaciones exclusivas para la EDICIÓN
        validate :impedir_edicion_fuera_de_periodo, on: :update

        # Callbacks
        before_save :marcar_si_es_fuera_de_tiempo
        before_destroy :validar_permiso_de_borrado

        private

        # --- NUEVA REGLA: RANGO DE FECHAS (INICIO Y FIN) ---
        def validar_rango_fechas_peticion
          return if issue.blank? || spent_on.blank?
          return if User.current && User.current.admin?

          inicio = issue.start_date
          fin = issue.due_date

          # Solo aplica si AMBAS fechas están cargadas en la petición
          if inicio.present? && fin.present?
            if spent_on < inicio || spent_on > fin
              errors.add(:spent_on, "debe estar entre la fecha de inicio (#{inicio.strftime('%d/%m/%Y')}) y la fecha fin (#{fin.strftime('%d/%m/%Y')}) de la petición.")
            end
          end
        end

        # --- NUEVA REGLA: IMPEDIR EDICIÓN FUERA DE PERIODO ---
        def impedir_edicion_fuera_de_periodo
          return if User.current && User.current.admin?

          custom_field = CustomField.find_by(name: TimeControl::PERIODS_FIELD)
          dias_maximos = TimeControl::DEFAULT_GRACE_DAYS
          meses_permitidos = []

          if custom_field
            if custom_field.description.present? && custom_field.description.strip =~ /\A\d+\z/
              dias_maximos = custom_field.description.strip.to_i
            end
            if custom_field.possible_values.is_a?(Array)
              meses_permitidos = custom_field.possible_values.map do |val|
                val.to_s.split(':').first.to_s.strip
              end.select { |val| val =~ /\A\d{6}\z/ }
            end
          end

          fecha_limite_dias = Date.today - dias_maximos
          
          # Evaluamos tanto la fecha original (por si intentan editar un registro ya bloqueado) 
          # como la nueva fecha (por si intentan moverlo a una fecha bloqueada)
          fecha_a_evaluar = spent_on_was || spent_on
          nueva_fecha = spent_on

          mes_old = fecha_a_evaluar.strftime("%Y%m") if fecha_a_evaluar
          mes_new = nueva_fecha.strftime("%Y%m") if nueva_fecha

          bloqueado_old = (fecha_a_evaluar && fecha_a_evaluar < fecha_limite_dias) || (meses_permitidos.any? && !meses_permitidos.include?(mes_old))
          bloqueado_new = (nueva_fecha && nueva_fecha < fecha_limite_dias) || (meses_permitidos.any? && !meses_permitidos.include?(mes_new))

          if bloqueado_old || bloqueado_new
            errors.add(:base, "Edición bloqueada: El periodo para la fecha de este registro ya se encuentra cerrado")
          end
        end

        #---- REGLA MAXIMO DE HORAS POR REGISTRO-----
        def validar_maximo_nueve_horas
          if self.hours && self.hours > TimeControl::MAX_HOURS_PER_ENTRY
            errors.add(:hours, "Maximas por registro excedidas (#{TimeControl::MAX_HOURS_PER_ENTRY.to_i} horas)")
          end
        end

        # --- REGLA 1: CONTROL DE TIEMPO ESTIMADO ---
        def validar_limite_de_horas_estimadas
          return if issue.blank?
          return if User.current && User.current.admin?

          horas_estimadas = issue.estimated_hours.to_f
          return if horas_estimadas == 0.0

          # Sumamos lo ya guardado (excluyendo este registro si se esta editando)
          horas_dedicadas_previas = issue.time_entries.where.not(id: id).sum(:hours).to_f
          horas_nuevas_solicitadas = self.hours.to_f
          total_acumulado_futuro = horas_dedicadas_previas + horas_nuevas_solicitadas

          if total_acumulado_futuro > horas_estimadas
            saldo_horas = horas_estimadas - horas_dedicadas_previas
            saldo_horas = 0.0 if saldo_horas < 0

            errors.add(:base, "Horas:: Se excede el limite de horas estimadas de la peticion \"##{issue.id}\". Horas estimadas totales: \"#{horas_estimadas}h\"; saldo de horas de la peticion: \"#{saldo_horas}h\"")
          end
        end

        # --- REGLA 2: CONTROL DE DIAS PASADOS Y MESES (CAMPO V_PERIODOS - SOLO CREACIÓN) ---
        def marcar_si_es_fuera_de_tiempo
          return unless new_record? # Ahora solo castiga con 0 horas a los registros nuevos
          return if spent_on.blank?
          return if User.current && User.current.admin?

          custom_field = CustomField.find_by(name: TimeControl::PERIODS_FIELD)
          dias_maximos = TimeControl::DEFAULT_GRACE_DAYS
          meses_permitidos = []

          if custom_field
            if custom_field.description.present? && custom_field.description.strip =~ /\A\d+\z/
              dias_maximos = custom_field.description.strip.to_i
            end

            if custom_field.possible_values.is_a?(Array)
              meses_permitidos = custom_field.possible_values.map do |val|
                val.to_s.split(':').first.to_s.strip
              end.select { |val| val =~ /\A\d{6}\z/ }
            end
          end

          fecha_limite_dias = Date.today - dias_maximos
          fuera_de_rango_dias = spent_on < fecha_limite_dias
          mes_del_registro = spent_on.strftime("%Y%m")
          mes_bloqueado = meses_permitidos.any? && !meses_permitidos.include?(mes_del_registro)

          if fuera_de_rango_dias || mes_bloqueado
            self.guardado_tarde = true 

            horas_intentadas = self.hours.to_f
            fecha_exacta_carga = Time.now.in_time_zone(TimeControl::TIMEZONE).strftime("%d/%m/%Y %H:%M:%S")

	    comentario_original = self.comments.present? ? "|#{self.comments}" : ""

            self.comments = "Periodo cerrado al reportar \"#{horas_intentadas.round(2)}\" horas el \"#{fecha_exacta_carga}\"#{comentario_original}"
            self.hours = 0.0
          end
        end

        # --- REGLA 3: IMPEDIR BORRADO ---
        def validar_permiso_de_borrado
          return true if User.current && User.current.admin?
          errors.add(:base, "No tienes permisos para eliminar registros de tiempo ya guardados. Contacta a Soporte TI.")
          throw :abort
        end

      end
    end
  end

  # =========================================================================
  # 2. Modificaciones al Controlador TimelogControlle
  # =========================================================================
  if timelog_controller_klass
    timelog_controller_klass.class_eval do

      # Parche para avisos de creación/edición tardía
      unless method_defined?(:mostrar_aviso_fuera_de_tiempo)
        after_action :mostrar_aviso_fuera_de_tiempo, only: [:create, :update]

        private

        def mostrar_aviso_fuera_de_tiempo
          time_entry = instance_variable_get(:@time_entry)
          if time_entry && time_entry.persisted? && time_entry.guardado_tarde
            flash[:error] = "Creado pero fuera de fecha, registra tus horas a tiempo!"
          end
        end
      end

      # Parche para mostrar el error de borrado denegado en la interfaz web
      unless method_defined?(:mostrar_error_al_borrar)
        after_action :mostrar_error_al_borrar, only: [:destroy]

        private

        def mostrar_error_al_borrar
          time_entries = instance_variable_get(:@time_entries)
          time_entry = instance_variable_get(:@time_entry)

          # Agrupamos todos los registros que se intentaron borrar
          registros = Array(time_entries).compact
          registros << time_entry if time_entry && !registros.include?(time_entry)

          # Filtramos únicamente los que NO pudieron ser eliminados
          no_eliminados = registros.select { |r| !r.destroyed? }

          if no_eliminados.any?
            mensajes = no_eliminados.map do |r|
              r.errors.full_messages.join(", ")
            end.reject(&:blank?).uniq.join("\n")

            if mensajes.present?
              # Inyectamos el error en el banner flash de Redmine
              flash[:error] = mensajes
            end
          end
        end
      end

    end
  end

# Forzar filtro por defecto en Tiempo Dedicado (Últimos 60 días)
  TimeEntryQuery.class_eval do
    prepend(Module.new do
      def initialize(*args)
        super
        if filters.has_key?('spent_on') && filters['spent_on'][:operator] == '*'
          filters['spent_on'] = {:operator => '>t-', :values => [TimeControl::DEFAULT_SPENT_ON_WINDOW_DAYS.to_s]}
        end
      end
    end)
  end
# Validación para restringir la modificación del Tiempo Estimado
  Issue.class_eval do
    validate :validate_estimated_hours_permissions

    def validate_estimated_hours_permissions
      if respond_to?(:estimated_hours_changed?) && estimated_hours_changed?
        admin_group = Group.find_by(lastname: TimeControl::ESTIMATED_HOURS_ADMIN_GROUP)
        if admin_group && User.current && !admin_group.users.include?(User.current)
          errors.add(:estimated_hours, ":: No tiene permisos para modificar las horas estimadas.")
        end
      end
    end
  end
# Forzar formato decimal en la visualización de horas (ej: 22.5 en vez de 22:30)
  ApplicationHelper.class_eval do
    def format_hours(hours)
      return "" if hours.blank?
      # Devuelve el número con hasta 2 decimales limpios, evitando el formato HH:MM
      sprintf("%.2f", hours).to_f.to_s
    end
  end
end
