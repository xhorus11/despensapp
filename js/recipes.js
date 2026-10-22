/* despensAPP · Recetario base
 * "id|Nombre|emoji|Categoría|minutos|porciones|ingredientes|pasos"
 * ingrediente: itemId:cantidad:unidad[:varianteId]  (separados por ;)
 * pasos separados por " / "
 */
const RECIPES_RAW = [
  // ---------- Rápidas ----------
  'pastas_pesto|Pastas al pesto|🍝|Rápida|20|4|fideos:400:g:spaghetti-5;pesto:190:g;queso:60:g:parmesano;aceite:20:ml:oliva-extra-virgen|Cuece los fideos al dente / Mezcla con el pesto y un chorrito del agua de cocción / Sirve con parmesano rallado',
  'fideos_mantequilla|Fideos con mantequilla y queso|🧈|Rápida|15|4|fideos:400:g:corbatas;mantequilla:50:g;queso:120:g:rallado|Cuece los fideos / Escurre y mezcla con mantequilla / Cubre con queso rallado',
  'arroz_atun|Arroz con atún y choclo|🍚|Rápida|25|4|arroz:300:g:grado-1;atun:2:un;choclolata:1:un;mayonesa:80:g;limon:1:un|Cocina el arroz / Mezcla con atún escurrido y choclo / Aliña con limón y mayonesa',
  'arroz_huevo|Arroz con huevo frito|🍳|Rápida|25|4|arroz:300:g:grado-1;huevo:4:un;aceite:60:ml;tomate:2:un|Cocina el arroz graneado / Fríe los huevos / Sirve con tomate picado',
  'quesadillas|Quesadillas de jamón y queso|🌮|Rápida|15|4|tortilla:8:un:trigo;queso:250:g:mantecoso;jamon:150:g;palta:2:un|Rellena las tortillas con queso y jamón / Dora en sartén por ambos lados / Acompaña con palta molida',
  'wrap_pollo|Wraps de pollo|🌯|Rápida|25|4|tortilla:8:un:trigo;pollo:500:g:pechuga-deshuesada;lechuga:1:un;tomate:2:un;mayonesa:80:g|Saltea el pollo en tiras / Arma los wraps con lechuga y tomate / Enrolla y corta en diagonal',
  'nuggets_papas|Nuggets con papas fritas|🍗|Rápida|25|4|nuggets:500:g;papasfritas:600:g;ketchup:80:g|Hornea o fríe las papas / Cocina los nuggets / Sirve con ketchup',
  'salchipapas|Salchipapas|🍟|Rápida|25|4|salchicha:8:un;papasfritas:800:g;ketchup:80:g;mayonesa:80:g;mostaza:30:g|Fríe las papas / Dora las vienesas en rodajas / Mezcla y sirve con salsas',
  'completos|Completos italianos|🌭|Rápida|20|4|pan:8:un:copihue-completo;salchicha:8:un;palta:3:un;tomate:3:un;mayonesa:150:g|Calienta las vienesas / Muele la palta y pica el tomate / Arma: tomate, palta y mayo',
  'hamburguesas|Hamburguesas caseras|🍔|Rápida|30|4|carnemolida:600:g:vacuno-10-grasa;pan:4:un:hamburguesa;queso:80:g:gauda-laminado;lechuga:1:un;tomate:2:un;ketchup:50:g|Forma 4 medallones y sazona / Cocina a la plancha y funde el queso encima / Arma con lechuga y tomate',
  'quesadilla_pollo|Sándwich de pollo palta|🥪|Rápida|20|4|pan:4:un:marraqueta;pollo:400:g:pechuga-deshuesada;palta:2:un;mayonesa:60:g|Cocina y desmenuza el pollo / Mezcla con mayo / Arma con palta',
  'barros_luco|Barros Luco|🥪|Chilena|20|4|pan:4:un:marraqueta;vacuno:400:g:lomo-liso;queso:200:g:mantecoso|Corta la carne en láminas finas / Plancha la carne y funde el queso encima / Sirve en marraqueta caliente',
  'huevos_revueltos|Huevos revueltos con tostadas|🍳|Desayuno|10|4|huevo:8:un;mantequilla:20:g;pan:4:un:molde-blanco;tomate:2:un|Bate los huevos con sal / Revuelve a fuego bajo con mantequilla / Sirve con pan tostado y tomate',
  'omelette|Omelette de jamón y queso|🍳|Desayuno|15|4|huevo:6:un;queso:100:g:gauda-laminado;jamon:100:g;mantequilla:15:g|Bate los huevos / Cuaja en sartén con mantequilla / Rellena con jamón y queso y dobla',
  'tostadas_palta|Tostadas con palta y huevo|🥑|Desayuno|15|4|pan:8:un:marraqueta;palta:3:un;huevo:4:un;limon:1:un|Tuesta el pan / Muele palta con limón y sal / Corona con huevo a la copa',
  // ---------- Caseras / Chilenas ----------
  'pastas_bolognesa|Pastas bolognesa|🍝|Casera|40|4|fideos:500:g:spaghetti-5;carnemolida:500:g:vacuno-10-grasa;salsatomate:400:g:pomarola;cebolla:1:un;zanahoria:1:un;ajo:10:g;queso:60:g:parmesano|Sofríe cebolla, zanahoria y ajo / Dora la carne y agrega la salsa, cocina 20 min / Sirve sobre los fideos con queso',
  'lasana|Lasaña de carne|🍝|Casera|75|6|fideos:300:g:lasana;carnemolida:500:g:vacuno-10-grasa;salsatomate:400:g:pomarola;queso:300:g:mozzarella;leche:500:ml;mantequilla:50:g;harina:50:g:sin-polvos|Prepara salsa de carne / Haz una bechamel con mantequilla, harina y leche / Arma capas y hornea 35 min',
  'pizza_casera|Pizza casera|🍕|Casera|90|4|harina:500:g:sin-polvos;levadura:10:g;queso:300:g:mozzarella;salsatomate:200:g:italiana;jamon:150:g;aceite:30:ml:oliva-extra-virgen|Amasa harina, levadura, agua y sal; deja leudar 1 h / Estira, cubre con salsa, queso y jamón / Hornea a 230° por 15 min',
  'tortilla_papas|Tortilla de papas|🥔|Casera|45|4|papa:800:g;huevo:6:un;cebolla:1:un;aceite:200:ml:maravilla|Fríe papas y cebolla en láminas a fuego medio / Mezcla con huevos batidos / Cuaja por ambos lados',
  'cazuela_vacuno|Cazuela de vacuno|🍲|Chilena|90|4|vacuno:800:g:osobuco;papa:4:un;zapallo:400:g;choclo:2:un:fresco;porotoverde:200:g;arroz:80:g:grado-1;cebolla:1:un;zanahoria:1:un|Cuece la carne con cebolla y zanahoria 1 h / Agrega papas, zapallo y choclo / Al final suma porotos verdes y arroz',
  'cazuela_pollo|Cazuela de pollo|🍲|Chilena|60|4|pollo:1000:g:trutro-entero;papa:4:un;zapallo:400:g;choclo:2:un:fresco;porotoverde:200:g;arroz:80:g:grado-1;cebolla:1:un;zanahoria:1:un|Dora el pollo y cubre con agua / Agrega verduras duras y cuece 25 min / Suma arroz y porotos verdes',
  'porotos_granados|Porotos granados|🫘|Chilena|60|4|porotoverde:800:g:granado;zapallo:400:g;choclo:3:un:pastelero;cebolla:1:un;albahaca:10:g;paprika:5:g|Sofríe cebolla con ají de color / Cuece porotos con zapallo 30 min / Agrega choclo rallado y albahaca',
  'porotos_riendas|Porotos con riendas|🫘|Chilena|120|4|poroto:500:g:hallado;fideos:150:g:spaghetti-5;zapallo:300:g;longaniza:200:g;cebolla:1:un;paprika:5:g|Remoja los porotos la noche anterior / Cuece con zapallo y sofrito 1,5 h / Agrega fideos y longaniza al final',
  'lentejas|Lentejas guisadas|🫘|Casera|50|4|lenteja:500:g:6-mm;arroz:100:g:grado-1;zanahoria:1:un;cebolla:1:un;pimenton:1:un;longaniza:150:g;comino:3:g|Sofríe cebolla, pimentón y zanahoria / Agrega lentejas y agua, cuece 30 min / Suma arroz y longaniza',
  'garbanzos|Garbanzos guisados|🫘|Casera|60|4|garbanzo:500:g:secos;zapallo:300:g;cebolla:1:un;espinaca:200:g;paprika:5:g|Remoja y cuece los garbanzos / Sofríe cebolla con ají de color / Junta todo con zapallo y espinaca',
  'pastel_choclo|Pastel de choclo|🌽|Chilena|90|6|choclo:10:un:pastelero;carnemolida:500:g:vacuno-10-grasa;pollo:400:g:trutro-corto;cebolla:2:un;huevo:2:un;aceitunas:60:g;albahaca:10:g;azucar:20:g:blanca|Prepara pino con carne y cebolla / Muele el choclo con albahaca y cocina hasta espesar / Arma en greda: pino, pollo, huevo, aceituna, pastelera y azúcar; gratina',
  'humitas|Humitas|🌽|Chilena|90|4|choclo:12:un:pastelero;cebolla:1:un;albahaca:10:g;mantequilla:50:g|Muele el choclo con cebolla sofrita y albahaca / Rellena las hojas y amarra / Cuece 40 min en agua hirviendo',
  'charquican|Charquicán|🥔|Chilena|45|4|carnemolida:400:g:vacuno-10-grasa;papa:1000:g;zapallo:500:g;choclo:1:un:fresco;arveja:150:g:congeladas;cebolla:1:un;huevo:4:un|Dora cebolla y carne / Cuece papas y zapallo y aplasta / Mezcla todo y corona con huevo frito',
  'carbonada|Carbonada|🍲|Chilena|60|4|vacuno:500:g:posta-negra;papa:4:un;zapallo:300:g;zanahoria:2:un;porotoverde:150:g;arroz:60:g:grado-1;cebolla:1:un|Dora la carne en cubos con cebolla / Agrega verduras en cubos y agua / Cuece 30 min y suma arroz',
  'pollo_arvejado|Pollo arvejado|🍗|Chilena|50|4|pollo:1000:g:trutro-corto;arveja:300:g:congeladas;zanahoria:2:un;cebolla:1:un;arroz:300:g:grado-1|Dora el pollo / Agrega cebolla, zanahoria y agua, cuece 25 min / Suma arvejas y sirve con arroz',
  'pollo_horno|Pollo al horno con papas|🍗|Casera|80|4|pollo:1500:g:pollo-entero;papa:1000:g;ajo:15:g;aceite:40:ml:oliva-extra-virgen;limon:1:un|Adoba el pollo con ajo, limón y aceite / Rodea con papas en gajos / Hornea a 200° por 1 h',
  'merluza_pure|Merluza frita con puré|🐟|Casera|45|4|merluza:800:g:filete;harina:150:g:sin-polvos;huevo:2:un;papa:1000:g;leche:200:ml;mantequilla:40:g;aceite:300:ml:maravilla|Pasa la merluza por huevo y harina, fríe / Cuece las papas y muele con leche y mantequilla / Sirve con limón',
  'pure_vienesas|Puré con vienesas|🌭|Rápida|25|4|papa:1000:g;salchicha:8:un;leche:250:ml;mantequilla:40:g|Cuece y muele las papas con leche y mantequilla / Calienta las vienesas / Sirve',
  'chorrillana|Chorrillana|🍟|Chilena|40|4|papasfritas:1000:g;vacuno:500:g:posta-negra;cebolla:2:un;huevo:4:un;salchicha:4:un|Fríe las papas / Saltea carne, vienesa y cebolla / Monta todo y corona con huevos fritos',
  'sopaipillas|Sopaipillas|🎃|Chilena|60|6|harina:500:g:con-polvos;zapallo:300:g;mantequilla:60:g;aceite:500:ml:maravilla;sal:8:g|Cuece y muele el zapallo / Amasa con harina y mantequilla derretida / Estira, corta y fríe',
  'pantrucas|Pantrucas|🍲|Sopas|40|4|harina:400:g:sin-polvos;huevo:1:un;caldo:2:un:cubo-carne;zanahoria:1:un;cebolla:1:un|Prepara masa con harina, huevo y agua / Sofríe cebolla y zanahoria y agrega caldo / Estira la masa en trozos y cuécelos en el caldo',
  'empanadas_pino|Empanadas de pino|🥟|Chilena|150|6|harina:1000:g:sin-polvos;mantequilla:150:g;carnemolida:700:g:vacuno-10-grasa;cebolla:4:un;huevo:3:un;aceitunas:60:g;paprika:10:g;frutadeshid:50:g:pasas|Prepara el pino el día anterior / Haz la masa y estírala / Rellena con pino, huevo, aceituna y pasas; hornea 25 min',
  // ---------- Internacionales ----------
  'lomo_saltado|Lomo saltado|🥩|Internacional|35|4|vacuno:600:g:lomo-liso;papasfritas:500:g;tomate:2:un;cebolla:1:un:morada;salsasoya:40:ml;vinagre:20:ml:vino-tinto;arroz:300:g:grado-1|Saltea la carne a fuego alto / Agrega cebolla, tomate, soya y vinagre / Mezcla con papas fritas y sirve con arroz',
  'arroz_chaufa|Arroz chaufa|🍚|Internacional|30|4|arroz:400:g:grado-1;pollo:300:g:pechuga-deshuesada;huevo:3:un;salsasoya:50:ml;cebolla:1:un:cebollin;jengibre:10:g;aceite:30:ml:maravilla|Usa arroz del día anterior / Saltea pollo, jengibre y cebollín / Agrega arroz, tortilla de huevo y soya',
  'pasta_camarones|Pasta con camarones al ajillo|🦐|Internacional|30|4|fideos:400:g:tallarin;camaron:400:g:ecuatoriano;crema:200:ml:de-leche;ajo:15:g;aceite:30:ml:oliva-extra-virgen;merken:2:g|Saltea ajo y camarones con merkén / Agrega crema y reduce / Mezcla con los fideos',
  'risotto|Risotto de champiñones|🍄|Internacional|40|4|arroz:350:g:arborio;champinon:300:g:paris;queso:80:g:parmesano;caldo:2:un:cubo-verduras;mantequilla:40:g;cebolla:1:un|Sofríe cebolla y nacara el arroz / Agrega caldo de a poco revolviendo / Incorpora champiñones salteados, mantequilla y queso',
  'tacos|Tacos mexicanos|🌮|Internacional|35|4|tortilla:12:un:maiz;carnemolida:500:g:vacuno-10-grasa;tomate:3:un;cebolla:1:un:morada;palta:2:un;queso:150:g:rallado;cilantro:1:un;comino:3:g|Cocina la carne con comino / Prepara pico de gallo y guacamole / Arma los tacos con queso',
  'chili|Chili con carne|🌶️|Internacional|60|4|carnemolida:500:g:vacuno-10-grasa;poroto:400:g:negro;tomatelata:2:un:triturados;cebolla:1:un;pimenton:1:un;comino:5:g;aji:1:un:jalapeno;arroz:300:g:grado-1|Sofríe cebolla y pimentón / Dora la carne con comino y ají / Agrega tomates y porotos cocidos, cuece 30 min',
  'fajitas|Fajitas de pollo|🌯|Internacional|30|4|pollo:600:g:pechuga-deshuesada;pimenton:3:un;cebolla:2:un;tortilla:8:un:trigo;crema:150:ml:acida;comino:3:g|Corta todo en tiras / Saltea pollo y verduras con comino / Sirve en tortillas con crema ácida',
  'curry_pollo|Curry de pollo|🍛|Internacional|40|4|pollo:700:g:pechuga-deshuesada;lechecoco:400:ml;curry:30:g:en-polvo;arroz:300:g:basmati;cebolla:1:un;jengibre:10:g|Sofríe cebolla, jengibre y curry / Dora el pollo / Agrega leche de coco y cuece 20 min; sirve con arroz',
  'sushi|Sushi casero|🍣|Internacional|90|4|arroz:500:g:para-sushi;nori:5:un;salmon:300:g:para-sushi-crudo;palta:1:un;queso:150:g:crema-untable;vinagre:60:ml:arroz;azucar:30:g:blanca;salsasoya:60:ml|Cocina el arroz y alíñalo con vinagre y azúcar / Extiende sobre nori y rellena / Enrolla, corta y sirve con soya',
  'noquis|Ñoquis caseros|🥔|Internacional|60|4|papa:1000:g;harina:300:g:sin-polvos;huevo:1:un;salsatomate:400:g:pomarola;queso:50:g:parmesano|Cuece y muele las papas / Forma masa con harina y huevo, corta los ñoquis / Cuécelos hasta que floten y sirve con salsa',
  'falafel|Falafel con ensalada|🧆|Vegetariana|60|4|garbanzo:400:g:secos;cebolla:1:un;ajo:10:g;perejil:1:un;comino:5:g;harina:40:g:sin-polvos;pan:4:un:pita;tomate:2:un;aceite:300:ml:maravilla|Remoja los garbanzos 12 h / Muele con cebolla, ajo, perejil y comino / Forma bolitas y fríe; sirve en pan pita',
  'wok_tofu|Salteado de verduras con tofu|🥢|Vegetariana|30|4|tofu:400:g:firme;brocoli:1:un;pimenton:2:un;zanahoria:2:un;salsasoya:50:ml;arroz:300:g:jazmin;jengibre:10:g|Dora el tofu en cubos / Saltea verduras a fuego alto con jengibre / Agrega soya y sirve con arroz',
  'wok_camarones|Wok de camarones y verduras|🦐|Saludable|30|4|camaron:400:g:ecuatoriano;brocoli:1:un;pimenton:2:un;cebolla:1:un:morada;salsasoya:40:ml;arroz:300:g:jazmin|Saltea las verduras a fuego alto / Agrega camarones y soya / Sirve con arroz',
  // ---------- Sopas ----------
  'sopa_pollo|Sopa de pollo con fideos|🍜|Sopas|45|4|pollo:500:g:trutro-corto;fideos:150:g:cabellos-de-angel;zanahoria:2:un;apio:1:un;papa:2:un|Cuece el pollo con verduras 30 min / Desmenuza el pollo / Agrega fideos los últimos 5 min',
  'crema_zapallo|Crema de zapallo|🎃|Sopas|40|4|zapallo:1000:g;cebolla:1:un;crema:200:ml:de-leche;caldo:1:un:cubo-verduras;mantequilla:20:g|Sofríe cebolla / Cuece el zapallo en caldo 20 min / Licúa y termina con crema',
  'crema_champinon|Crema de champiñones|🍄|Sopas|35|4|champinon:500:g:paris;cebolla:1:un;crema:200:ml:de-leche;mantequilla:30:g;caldo:1:un:cubo-verduras;harina:20:g:sin-polvos|Saltea cebolla y champiñones / Agrega harina y caldo, cuece 15 min / Licúa y suma crema',
  'sopa_verduras|Sopa de verduras|🥕|Sopas|40|4|zanahoria:2:un;papa:3:un;zapallito:1:un;apio:1:un;porotoverde:150:g;caldo:1:un:cubo-verduras;cebolla:1:un|Pica todas las verduras / Sofríe cebolla y agrega caldo / Cuece 25 min',
  'crema_brocoli|Crema de brócoli|🥦|Sopas|30|4|brocoli:2:un;papa:2:un;cebolla:1:un;leche:300:ml;caldo:1:un:cubo-verduras|Cuece brócoli y papa en caldo / Licúa con leche / Rectifica sal y sirve',
  // ---------- Ensaladas / Saludable ----------
  'ensalada_chilena|Ensalada chilena|🍅|Ensaladas|10|4|tomate:6:un:limachino;cebolla:1:un;cilantro:1:un;aceite:20:ml:oliva-extra-virgen|Pela y corta el tomate en pluma / Cebolla en pluma desflemada / Aliña con cilantro, aceite y sal',
  'ensalada_cesar|Ensalada César|🥗|Ensaladas|25|4|lechuga:2:un:costina;pollo:400:g:pechuga-deshuesada;pan:2:un:marraqueta;queso:50:g:parmesano;mayonesa:80:g;limon:1:un|Cocina y trocea el pollo / Tuesta crutones de pan / Mezcla con lechuga, aderezo y parmesano',
  'ensalada_quinoa|Ensalada de quinoa|🥗|Saludable|25|4|quinoa:250:g:blanca;tomate:200:g:cherry;pepino:1:un;palta:1:un;limon:1:un;aceite:20:ml:oliva-extra-virgen|Lava y cuece la quinoa 15 min / Pica las verduras / Mezcla y aliña con limón y aceite',
  'ensalada_atun|Ensalada completa de atún|🥗|Saludable|20|4|atun:2:un:en-agua;lechuga:1:un;tomate:3:un;huevo:3:un;choclolata:1:un;aceite:20:ml:oliva-extra-virgen|Cuece los huevos / Trocea lechuga y tomate / Junta con atún y choclo, aliña',
  'ensalada_lentejas|Ensalada de lentejas|🥗|Saludable|35|4|lenteja:300:g:6-mm;tomate:2:un;cebolla:1:un:morada;pimenton:1:un;limon:1:un;aceite:20:ml:oliva-extra-virgen|Cuece las lentejas firmes / Pica las verduras / Mezcla y aliña',
  'papas_mayo|Papas mayo|🥔|Ensaladas|30|4|papa:1000:g;mayonesa:150:g;perejil:1:un|Cuece las papas en cubos / Enfría / Mezcla con mayo y perejil',
  'bowl_pollo|Bowl de pollo y palta|🥙|Saludable|30|4|arroz:300:g:integral;pollo:500:g:pechuga-deshuesada;palta:2:un;choclolata:1:un;tomate:2:un;limon:1:un|Cocina arroz integral / Plancha el pollo / Arma bowls con palta, choclo y tomate',
  'salmon_horno|Salmón al horno con verduras|🐟|Saludable|35|4|salmon:800:g:filete;papa:600:g;brocoli:1:un;limon:1:un;aceite:30:ml:oliva-extra-virgen|Hornea las papas 15 min / Agrega salmón y brócoli con limón / Hornea 15 min más',
  'reineta_plancha|Reineta a la plancha con ensalada|🐟|Saludable|25|4|reineta:800:g:filete;lechuga:1:un;tomate:3:un;limon:1:un;aceite:20:ml:oliva-extra-virgen|Sazona la reineta con limón / Plancha 3 min por lado / Sirve con ensalada',
  'pollo_quinoa|Pollo a la plancha con quinoa|🍗|Saludable|30|4|pollo:600:g:pechuga-deshuesada;quinoa:250:g:tricolor;brocoli:1:un;limon:1:un;aceite:20:ml:oliva-extra-virgen|Cuece la quinoa / Plancha el pollo / Sirve con brócoli al vapor',
  'zapallitos_rellenos|Zapallitos italianos rellenos|🥒|Casera|50|4|zapallito:1000:g:redondo;carnemolida:400:g:vacuno-5-grasa;queso:150:g:mozzarella;cebolla:1:un;salsatomate:200:g:pomarola|Ahueca los zapallitos / Rellena con pino de carne y pulpa / Cubre con queso y hornea 25 min',
  'pimentones_rellenos|Pimentones rellenos|🫑|Vegetariana|50|4|pimenton:4:un;arroz:200:g:grado-1;queso:150:g:mozzarella;choclolata:1:un;cebolla:1:un|Cocina el arroz / Mezcla con choclo, cebolla y queso / Rellena los pimentones y hornea 30 min',
  'budin_zapallitos|Budín de zapallitos|🥒|Vegetariana|50|4|zapallito:1000:g;huevo:4:un;queso:150:g:gauda-laminado;leche:200:ml;cebolla:1:un|Saltea zapallitos con cebolla / Mezcla con huevos, leche y queso / Hornea 30 min',
  'tortilla_espinaca|Tortilla de espinaca|🥬|Vegetariana|25|4|espinaca:300:g:hoja;huevo:6:un;cebolla:1:un;queso:100:g:rallado|Saltea cebolla y espinaca / Mezcla con huevos batidos y queso / Cuaja por ambos lados',
  'guiso_zapallitos|Guiso de zapallo italiano|🥒|Vegetariana|35|4|zapallito:1000:g;choclo:2:un:fresco;cebolla:1:un;huevo:3:un;queso:100:g:rallado|Sofríe cebolla y zapallitos en cubos / Agrega choclo desgranado / Termina con huevo revuelto y queso',
  'hummus_verduras|Hummus con bastones de verdura|🫘|Saludable|20|4|garbanzo:400:g:cocidos-en-lata;limon:1:un;ajo:5:g;aceite:40:ml:oliva-extra-virgen;zanahoria:3:un;pepino:1:un|Procesa garbanzos con limón, ajo y aceite / Corta bastones de verdura / Sirve para picar',
  // ---------- Desayunos ----------
  'avena_fruta|Avena con fruta|🥣|Desayuno|10|4|avena:200:g:tradicional;leche:800:ml;platano:2:un;miel:40:g;canela:3:g:molida|Cuece la avena en leche 5 min / Agrega canela / Sirve con plátano y miel',
  'smoothie|Smoothie de frutilla y plátano|🥤|Desayuno|5|4|frutacong:400:g:frutilla;platano:2:un;leche:600:ml;miel:30:g|Licúa todo / Sirve frío',
  'panqueques_avena|Panqueques de avena y plátano|🥞|Desayuno|20|4|avena:200:g:tradicional;huevo:3:un;platano:2:un;leche:200:ml|Licúa todo / Cocina en sartén antiadherente / Sirve con fruta',
  'yogur_granola|Yogur con granola y berries|🥣|Desayuno|5|4|yogurt:4:un:griego;cereal:200:g:granola;arandano:200:g;miel:40:g|Sirve el yogur / Agrega granola y arándanos / Termina con miel',
  'sandwich_huevo|Sándwich de huevo y jamón|🥪|Desayuno|15|4|pan:4:un:hallulla;huevo:4:un;jamon:120:g;queso:80:g:gauda-laminado|Fríe o revuelve los huevos / Calienta el pan / Arma con jamón y queso',
  'pan_molde|Pan de molde casero|🍞|Repostería|180|8|harina:1000:g:sin-polvos;levadura:10:g;leche:300:ml;mantequilla:50:g;azucar:20:g:blanca;sal:15:g|Amasa todo 10 min / Deja leudar 1 h y forma el pan / Leuda 40 min más y hornea a 180° 35 min',
  'chilaquiles|Huevos rancheros|🍳|Desayuno|25|4|huevo:8:un;tomatelata:1:un:triturados;tortilla:8:un:maiz;cebolla:1:un;palta:1:un;queso:100:g:rallado|Prepara salsa de tomate y cebolla / Cocina los huevos en la salsa / Sirve sobre tortillas con palta y queso',
  // ---------- Repostería ----------
  'queque_vainilla|Queque de vainilla|🍰|Repostería|60|8|harina:300:g:con-polvos;azucar:250:g:blanca;huevo:4:un;mantequilla:150:g;leche:120:ml;vainilla:10:ml|Bate mantequilla con azúcar / Agrega huevos, leche y vainilla / Incorpora harina y hornea a 180° por 40 min',
  'brownie|Brownie|🍫|Repostería|45|8|chocolate:200:g:amargo-70;mantequilla:150:g;azucar:250:g:blanca;huevo:3:un;harina:120:g:sin-polvos;frutossecos:100:g:nueces|Derrite chocolate con mantequilla / Bate con azúcar y huevos / Agrega harina y nueces; hornea 25 min',
  'tres_leches|Torta tres leches|🎂|Repostería|90|10|harina:200:g:con-polvos;huevo:6:un;azucar:300:g:blanca;leche:400:ml;lechecondensada:1:un;lecheevap:1:un;crema:200:ml:para-batir|Prepara bizcocho y hornea / Mezcla las tres leches / Remoja el bizcocho y cubre con crema batida',
  'kuchen_manzana|Kuchen de manzana|🍎|Repostería|70|8|harina:300:g:con-polvos;mantequilla:150:g;azucar:200:g:blanca;huevo:2:un;manzana:4:un:verde;canela:3:g:molida|Prepara masa y forra el molde / Cubre con manzana en láminas y canela / Hornea 40 min',
  'panqueques_manjar|Panqueques con manjar|🥞|Repostería|40|4|harina:200:g:sin-polvos;leche:500:ml;huevo:2:un;manjar:300:g;azucar:20:g:flor|Licúa harina, leche y huevos / Cocina panqueques finos / Rellena con manjar y espolvorea azúcar flor',
  'galletas_chips|Galletas con chips de chocolate|🍪|Repostería|35|6|harina:280:g:con-polvos;mantequilla:170:g;azucar:200:g:rubia;huevo:1:un;chips:200:g:semi-amargo;vainilla:5:ml|Bate mantequilla y azúcar / Agrega huevo, vainilla, harina y chips / Forma bolitas y hornea 12 min',
  'leche_asada|Leche asada|🍮|Repostería|70|6|leche:1000:ml;huevo:6:un;azucar:250:g:blanca;vainilla:5:ml|Carameliza 100 g de azúcar en el molde / Mezcla leche, huevos, azúcar y vainilla / Hornea a baño maría 50 min',
  'mote_huesillo|Mote con huesillo|🍑|Chilena|180|6|mote:300:g;frutadeshid:300:g:huesillos;azucar:200:g:rubia;canela:5:g:rama|Remoja los huesillos la noche anterior / Cuécelos con azúcar y canela / Enfría y sirve con mote cocido',
  'arroz_leche|Arroz con leche|🍚|Repostería|45|6|arroz:200:g:grado-1;leche:1000:ml;azucar:150:g:blanca;canela:5:g:rama|Cuece el arroz en leche con canela a fuego bajo / Agrega azúcar al final / Sirve con canela molida',
  'semola_leche|Sémola con leche|🥣|Repostería|20|6|semola:120:g;leche:1000:ml;azucar:100:g:blanca;vainilla:5:ml|Hierve la leche con azúcar / Agrega sémola en lluvia revolviendo / Cuaja en moldes',
  'queque_platano|Queque de plátano|🍌|Repostería|60|8|platano:3:un;harina:250:g:sin-polvos;azucar:150:g:rubia;huevo:2:un;mantequilla:100:g;polvohornear:10:g|Muele los plátanos / Mezcla con mantequilla, azúcar y huevos / Agrega harina y polvos; hornea 45 min',
  'cheesecake|Cheesecake de frutilla|🍰|Repostería|60|8|galletas:2:un:mantequilla;mantequilla:80:g;queso:400:g:crema-untable;crema:200:ml:para-batir;azucar:120:g:blanca;gelatina:1:un:sin-sabor;mermelada:250:g:frutilla|Muele galletas con mantequilla y forma la base / Bate queso, crema, azúcar y gelatina hidratada / Refrigera 4 h y cubre con mermelada',
  'mousse|Mousse de chocolate|🍫|Repostería|30|6|chocolate:200:g:amargo-70;huevo:4:un;crema:200:ml:para-batir;azucar:50:g:blanca|Derrite el chocolate / Agrega yemas y crema batida / Incorpora claras a nieve y refrigera 3 h',
  'calzones_rotos|Calzones rotos|🍩|Repostería|60|8|harina:500:g:con-polvos;huevo:2:un;azucar:100:g:blanca;mantequilla:50:g;aceite:500:ml:maravilla|Amasa todo / Corta rombos con un tajo al centro y da vuelta una punta / Fríe y espolvorea azúcar flor',
  'alfajores|Alfajores de maicena|🍪|Repostería|60|8|harina:300:g:maicena;mantequilla:200:g;azucar:150:g:flor;huevo:3:un;manjar:400:g;coco:50:g|Bate mantequilla y azúcar con yemas / Agrega maicena y estira / Hornea, rellena con manjar y pasa por coco',
  'galletas_avena|Galletas de avena|🍪|Saludable|30|6|avena:250:g:tradicional;platano:2:un;frutadeshid:80:g:pasas;canela:3:g:molida|Muele los plátanos / Mezcla con avena, pasas y canela / Forma galletas y hornea 15 min',
  'pie_limon|Pie de limón|🍋|Repostería|80|8|galletas:2:un:de-vino;mantequilla:100:g;lechecondensada:2:un;limon:6:un:de-pica;huevo:4:un;azucar:150:g:blanca|Base de galleta con mantequilla / Mezcla condensada, yemas y jugo de limón / Cubre con merengue y dora',
];

const Recipes = (() => {
  const base = RECIPES_RAW.map(line => {
    const [id, name, emoji, cat, min, serves, ings, steps] = line.split('|');
    return {
      id, name, emoji, cat, min: +min, serves: +serves,
      ings: ings.split(';').map(s => {
        const [i, q, u, v] = s.split(':');
        const f = Catalog.find(i);
        return { c: f ? f.c : 'otros', i, q: parseFloat(q), u, v: v || (f && f.item.vars[0] ? f.item.vars[0].id : '') };
      }),
      steps: (steps || '').split(' / ').filter(Boolean),
    };
  });

  function all() {
    const custom = (typeof Store !== 'undefined' && Store.state.recipes) ? Object.values(Store.state.recipes).filter(r => !r.del) : [];
    return [...base, ...custom];
  }
  function get(id) { return all().find(r => r.id === id) || null; }
  function cats() { return [...new Set(all().map(r => r.cat))]; }

  // Ingredientes escalados por personas y adaptados según modo de dieta
  // mode: 'aparte' | 'apto' | 'no'
  function needs(rec, people, mode, members) {
    const f = people / rec.serves;
    const out = [];
    const push = (c, i, v, q, u, note) => {
      const ex = out.find(x => x.c === c && x.i === i && x.v === v && x.u === u);
      if (ex) ex.q += q; else out.push({ c, i, v, q, u, note });
    };
    const mem = members || Store.state.household.members;
    rec.ings.forEach(ing => {
      const q = Units.round(ing.q * f, ing.u);
      const conf = Diet.conflicts(ing.c, ing.i, ing.v, mem);
      if (!conf.length || mode === 'no') { push(ing.c, ing.i, ing.v, q, ing.u, conf.length ? Diet.warnText(conf) : ''); return; }
      const forb = [...new Set(conf.flatMap(x => Diet.forbidden(x.member)))];
      const alt = Diet.alt(ing.c, ing.i, ing.v, forb, conf.map(x => x.member));
      if (mode === 'apto') {
        if (alt) push(ing.c, ing.i, alt, q, ing.u, 'adaptado para ' + conf.map(x => x.member).join(', '));
        else push(ing.c, ing.i, ing.v, q, ing.u, '⚠️ sin alternativa: ' + Diet.warnText(conf));
      } else { // aparte
        const k = conf.length;
        const qMain = Units.round(ing.q * f * Math.max(0, people - k) / people, ing.u);
        const qAlt = Units.round(ing.q * f * k / people, ing.u);
        if (qMain > 0) push(ing.c, ing.i, ing.v, qMain, ing.u, '');
        if (alt && qAlt > 0) push(ing.c, ing.i, alt, qAlt, ing.u, 'porción aparte: ' + conf.map(x => x.member).join(', '));
        else if (qAlt > 0) push(ing.c, ing.i, ing.v, qAlt, ing.u, '⚠️ sin alternativa: ' + Diet.warnText(conf));
      }
    });
    return out;
  }

  // Compatibilidad de la receta con dietas, alergias, alimentos prohibidos y condiciones de salud
  function compat(rec) {
    const res = [];
    Store.state.household.members.forEach(m => {
      const forb = Diet.forbidden(m), ban = Diet.bannedItems(m), warn = Diet.cautionTags(m);
      if (!forb.length && !ban.length && !warn.length) return;
      const bad = rec.ings.filter(ing => ban.includes(ing.i) || Catalog.tags(ing.c, ing.i, ing.v).some(t => forb.includes(t)));
      const cau = rec.ings.filter(ing => Catalog.tags(ing.c, ing.i, ing.v).some(t => warn.includes(t)));
      const cauTags = [...new Set(cau.flatMap(ing => Catalog.tags(ing.c, ing.i, ing.v).filter(t => warn.includes(t))))];
      const cautions = cau.length ? {
        items: [...new Set(cau.map(b => Catalog.item(b.c, b.i).name))],
        tags: cauTags, conds: [...new Set(cauTags.map(t => Diet.condFor(m, t)))],
      } : null;
      if (!bad.length) { res.push({ member: m, ok: true, cautions }); return; }
      const fixable = bad.every(ing => Diet.alt(ing.c, ing.i, ing.v, forb, [m]));
      res.push({ member: m, ok: false, fixable, bad: [...new Set(bad.map(b => Catalog.item(b.c, b.i).name))], cautions });
    });
    return res;
  }

  // ¿Hay algo que advertir antes de usar la receta?
  function issues(rec, mode) {
    const c = compat(rec);
    return {
      blocks: c.filter(x => !x.ok && !(x.fixable && mode !== 'no')),
      adapted: c.filter(x => !x.ok && x.fixable && mode !== 'no'),
      cautions: c.filter(x => x.cautions),
    };
  }

  return { all, get, cats, needs, compat, issues, base };
})();

if (typeof module !== 'undefined') module.exports = { Recipes, RECIPES_RAW };
