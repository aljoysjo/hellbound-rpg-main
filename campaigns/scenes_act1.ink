=== act1_scene1 ===

# Las Puertas de Ceniza - Acto I

Te encuentras ante las imponentes Puertas de Ceniza, estructura colosal que marca la frontera entre el mundo mortal y los dominios infernales. 

El viento nocturno arrastra consigo cenizas que brillan con un fuego sobrenatural, y los grabados en las puertas parecen moverse bajo la luz de la luna roja.

Como exorcista, tu misión es clara: adentrarte en estos dominios para enfrentar al Príncipe Caído, pero primero debes demostrar tu valor superando las pruebas iniciales.

* [Examinar las runas de las puertas] -> examine_runes
* [Tocar las puertas directamente] -> touch_gates  
* [Invocar una oración de protección] -> prayer
* [Buscar una entrada alternativa] -> alternative_path

=== examine_runes ===

Las runas brillan al acercarte, revelando una escritura demoníaca antigua. Puedes descifrar fragmentos:

"Solo aquellos que han conocido la pérdida pueden abrir el camino..."
"El fuego sagrado debe balancear el fuego infernal..."
"Tres pruebas aguardan: Valor, Sabiduría, Sacrificio..."

Tu maná se agita, reconociendo el poder arcano. (-5 maná)

* [Trazar una contra-runa con tu poder] -> counter_rune
* [Retroceder y buscar otra aproximación] -> retreat
* [Continuar leyendo las runas más profundas] -> deep_runes

=== touch_gates ===

Al tocar las puertas, una descarga de energía infernal recorre tu cuerpo. El metal ennegrecido quema tu piel, pero tu entrenamiento como exorcista te protege del daño mayor.

Las puertas se abren lentamente con un estruendo que hace temblar la tierra. (-10 salud, +5 experiencia)

Un pasillo oscuro se extiende ante ti, iluminado por antorchas que arden con llamas verdes.

* [Avanzar con precaución] -> careful_advance
* [Correr hacia el interior] -> rush_inside
* [Bendecir el umbral antes de entrar] -> bless_threshold

=== prayer ===

Entonas una oración a los poderes celestiales. Tu voz resuena con fuerza divina, y una luz dorada te envuelve momentáneamente.

Las puertas reaccionan a tu fe, abriéndose sin resistencia. Has demostrado que tu corazón es puro. (+10 maná, +5 salud)

El camino ahead está iluminado por una suave luz dorada que emana de tu presencia santificada.

* [Entrar con confianza] -> confident_entry
* [Mantener la oración mientras avanzas] -> continuous_prayer
* [Agradecer antes de continuar] -> thankful_advance

=== alternative_path ===

Rodeas las puertas principales buscando otra entrada. Tras varios minutos de búsqueda, descubres una fisura en el muro lateral, apenas lo suficientemente grande para una persona.

Es una entrada de servicio olvidada, pero podrías usarla para infiltrarte sin activar las defensas principales.

* [Entrar por la fisura] -> secret_entrance
* [Regresar a las puertas principales] -> return_gates
* [Ampliar la fisura con tu poder] -> widen_crack

=== counter_rune ===

Trazas una contra-runa con tu dedo, canalizando tu poder sagrado. La runa demoníaca se desvanece con un siseo, reemplazada por tu símbolo de protección.

Las puertas reconocen tu maestría mágica y se abren, pero has gastado una cantidad significativa de energía. (-15 maná, +10 experiencia)

=== END ===