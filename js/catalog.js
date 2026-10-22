/* despensAPP · Catálogo maestro
 * Formato compacto por producto:
 *   "id|Nombre|emoji|unidad[/tamaño]|tags|Variante1,Variante2:+tag-tag,..."
 *   unidad: g | kg | ml | L | un      tamaño: equivalencia de 1 un (ej: kg/150g, un/1L)
 *   tags: separados por + (gluten, lactosa, huevo, carne, cerdo, pescado, mariscos,
 *         frutos_secos, mani, soya, alcohol, azucar, miel) — "-" = ninguno
 *   en variantes, ":+tag" agrega y ":-tag" quita etiquetas respecto del producto base.
 */
const CATALOG_RAW = [
  ['fruver', 'Frutas y Verduras', '🥕', [
    'manzana|Manzana|🍎|kg/180g|-|Roja,Verde,Fuji,Pink Lady',
    'platano|Plátano|🍌|kg/150g|-|Ecuatoriano,Orgánico',
    'naranja|Naranja|🍊|kg/200g|-|Jugo,Mesa',
    'mandarina|Mandarina|🍊|kg/100g|-|Clementina,Murcott',
    'limon|Limón|🍋|kg/80g|-|Común,Sutil,De Pica',
    'palta|Palta|🥑|kg/200g|-|Hass,Negra de la Cruz,Edranol',
    'tomate|Tomate|🍅|kg/150g|-|Larga vida,Cherry,Limachino,Perita',
    'lechuga|Lechuga|🥬|un|-|Escarola,Costina,Hidropónica,Milanesa,Española',
    'cebolla|Cebolla|🧅|kg/150g|-|Común,Morada,Cebollín,Perla',
    'ajo|Ajo|🧄|un/50g|-|Cabeza,Pelado,Chilote',
    'papa|Papa|🥔|kg/180g|-|Blanca,Rosada,Camote,Nativa',
    'zanahoria|Zanahoria|🥕|kg/100g|-|Común,Baby,Rallada',
    'zapallo|Zapallo|🎃|kg|-|Camote,Butternut,Trozado',
    'zapallito|Zapallo italiano|🥒|kg/250g|-|Verde,Redondo',
    'pimenton|Pimentón|🫑|un/200g|-|Rojo,Verde,Amarillo',
    'pepino|Pepino|🥒|un/300g|-|Ensalada,Dulce',
    'brocoli|Brócoli|🥦|un/400g|-|Fresco',
    'coliflor|Coliflor|🥦|un/600g|-|Fresca',
    'repollo|Repollo|🥬|un/1kg|-|Verde,Morado',
    'choclo|Choclo|🌽|un/250g|-|Fresco,Pastelero',
    'champinon|Champiñón|🍄|g|-|Paris,Portobello,Ostra',
    'espinaca|Espinaca|🥬|g|-|Hoja,Baby',
    'apio|Apio|🥬|un|-|Rama',
    'porotoverde|Poroto verde|🫛|g|-|Fresco,Granado',
    'berenjena|Berenjena|🍆|un/300g|-|Fresca',
    'betarraga|Betarraga|🟣|kg/200g|-|Fresca,Cocida',
    'aji|Ají|🌶️|un|-|Verde,Cacho de cabra,Jalapeño',
    'cilantro|Cilantro|🌿|un|-|Atado',
    'perejil|Perejil|🌿|un|-|Atado',
    'albahaca|Albahaca|🌿|g|-|Fresca',
    'jengibre|Jengibre|🫚|g|-|Fresco',
    'frutilla|Frutilla|🍓|g|-|Fresca',
    'arandano|Arándano|🫐|g|-|Fresco',
    'uva|Uva|🍇|kg|-|Red Globe,Thompson,Negra',
    'pera|Pera|🍐|kg/180g|-|Packham,Asiática',
    'kiwi|Kiwi|🥝|kg/90g|-|Verde,Gold',
    'durazno|Durazno|🍑|kg/150g|-|Blanco,Conservero',
    'pina|Piña|🍍|un|-|Golden',
    'sandia|Sandía|🍉|un|-|Entera,Media',
    'melon|Melón|🍈|un|-|Tuna,Calameño',
    'acelga|Acelga|🥬|un|-|Atado',
    'alcachofa|Alcachofa|🌿|un|-|Fresca',
    'esparrago|Espárrago|🌿|g|-|Verde,Blanco',
    'rabanito|Rabanito|🔴|un|-|Atado',
    'cebollin|Ciboulette|🌿|g|-|Fresco',
    'menta|Menta / hierbabuena|🌿|un|-|Atado',
    'romero|Hierbas frescas|🌿|un|-|Romero,Tomillo,Orégano fresco,Eneldo',
    'mango|Mango|🥭|un|-|Fresco',
    'cereza|Cereza|🍒|g|-|Fresca',
    'ciruela|Ciruela|🟣|kg|-|Roja,Amarilla',
    'damasco|Damasco|🍑|kg|-|Fresco',
    'nectarin|Nectarín|🍑|kg|-|Fresco',
    'frambuesa|Frambuesa|🍓|g|-|Fresca',
    'chirimoya|Chirimoya|🍈|kg|-|Fresca',
    'papaya|Papaya|🍈|un|-|Fresca,En almíbar:+azucar',
    'tuna|Tuna|🌵|un|-|Fresca',
    'granada|Granada|🔴|un|-|Fresca',
    'lucuma|Lúcuma|🟤|g|-|Pulpa congelada,Harina',
    'ensaladalista|Ensalada lista (bolsa)|🥗|un|-|Mix hojas,Lechuga picada,Repollo rallado,Zanahoria rallada,Choclo desgranado',
    'frutapicada|Fruta picada|🍉|un|-|Mix frutas,Melón,Piña,Sandía',
  ]],
  ['carnes', 'Carnes y Pescados', '🥩', [
    'pollo|Pollo|🍗|kg|carne|Pechuga deshuesada,Trutro entero,Trutro corto,Pollo entero,Alitas,Filetitos',
    'carnemolida|Carne molida|🥩|g|carne|Vacuno 5% grasa,Vacuno 10% grasa:+grasas,Pavo,Vegetal (soya):-carne+soya',
    'vacuno|Vacuno|🥩|kg|carne|Lomo liso,Lomo vetado:+grasas,Posta negra,Posta rosada,Asiento,Plateada:+grasas,Huachalomo,Abastero,Osobuco,Punta paleta',
    'cerdo|Cerdo|🐖|kg|carne+cerdo|Chuleta centro,Costillar:+grasas,Lomo,Pulpa,Malaya:+grasas',
    'pavo|Pavo|🦃|kg|carne|Pechuga,Trutro',
    'salchicha|Vienesas|🌭|un|carne+cerdo+sodio+grasas|Tradicional,De pavo:-cerdo,Vegana:-carne-cerdo+soya',
    'hamburguesa|Hamburguesa|🍔|un|carne|Vacuno,Pollo,Vegetal:-carne+soya',
    'longaniza|Longaniza|🌭|g|carne+cerdo+sodio+grasas|Chillán,Parrillera',
    'chorizo|Chorizo|🌭|g|carne+cerdo+sodio+grasas|Parrillero,Español',
    'salmon|Salmón|🐟|g|pescado|Filete,Porción congelada,Ahumado:+sodio+crudo,Para sushi (crudo):+crudo',
    'reineta|Reineta|🐟|g|pescado|Filete',
    'merluza|Merluza|🐟|g|pescado|Filete,Apanada:+gluten',
    'camaron|Camarón|🦐|g|mariscos+purinas|Ecuatoriano,Cóctel,Apanado:+gluten',
    'choritos|Choritos|🦪|g|mariscos+purinas|En concha,Pelados',
    'mixmariscos|Mix de mariscos|🦑|g|mariscos+purinas|Congelado',
    'cordero|Cordero|🐑|kg|carne|Pierna,Costillar,Chuleta',
    'interiores|Interiores|🫀|g|carne+purinas|Hígado,Guatitas,Lengua,Riñones,Corazón',
    'prieta|Prieta|🌭|un|carne+cerdo+sodio+grasas|Tradicional',
    'churrasco|Churrasco / lomito|🥩|un|carne|Churrasco vacuno,Lomito de cerdo:+cerdo,Pollo apanado:+gluten',
    'congrio|Congrio|🐟|g|pescado|Colorado,Dorado',
    'calamar|Calamar y pulpo|🦑|g|mariscos+purinas|Anillos de calamar,Pulpo,Calamar apanado:+gluten',
    'otrosmariscos|Mariscos de concha|🐚|g|mariscos+purinas|Almejas,Machas,Ostiones,Locos,Jaiba',
    'kanikama|Kanikama / surimi|🦀|g|pescado+gluten|Barritas',
    'atunfresco|Atún fresco|🐟|g|pescado|Lomo',
    'pescadoahumado|Pescado ahumado|🐟|g|pescado+sodio+crudo|Salmón ahumado,Trucha ahumada',
  ]],
  ['lacteos', 'Lácteos y Huevos', '🧀', [
    'leche|Leche|🥛|un/1L|lactosa|Entera,Semidescremada,Descremada,Sin lactosa:-lactosa,Chocolate:+azucar,Frutilla:+azucar',
    'queso|Queso|🧀|g|lactosa|Gauda laminado,Mantecoso,Chanco,Parmesano:+sodio,Mozzarella,Rallado:+sodio,Crema untable,Sin lactosa:-lactosa',
    'quesillo|Quesillo|🧀|un|lactosa|Tradicional,Light',
    'yogurt|Yogur|🥛|un|lactosa|Natural,Batido frutilla:+azucar,Griego,Protein,Sin lactosa:-lactosa,Vegetal:-lactosa+soya',
    'mantequilla|Mantequilla|🧈|g|lactosa+grasas|Con sal,Sin sal,Sin lactosa:-lactosa',
    'margarina|Margarina|🧈|g|grasas|Untable,Vegetal',
    'crema|Crema|🥛|ml|lactosa|De leche:+grasas,Para batir:+grasas,Ácida,Vegetal:-lactosa',
    'huevo|Huevos|🥚|un|huevo|Blanco grande,Color extra,Gallina libre,Codorniz',
    'manjar|Manjar|🍯|g|lactosa+azucar|Tradicional,Sin azúcar:-azucar',
    'lechecondensada|Leche condensada|🥫|un|lactosa+azucar|Normal',
    'lecheevap|Leche evaporada|🥫|un|lactosa|Normal,Light',
    'lechepolvo|Leche en polvo|🥛|g|lactosa|Entera,Descremada,Crecimiento,Sin lactosa:-lactosa',
    'lechecultivada|Leche cultivada / bebida láctea|🥛|un|lactosa+azucar|Frutilla,Vainilla,Natural:-azucar,Kéfir:-azucar',
    'postrelacteo|Postres refrigerados|🍮|un|lactosa+azucar|Flan,Leche asada,Sémola con leche,Arroz con leche,Mousse chocolate,Jalea:-lactosa',
    'quesofresco|Queso fresco|🧀|g|lactosa|Fresco,Ricotta,Cottage,De cabra',
  ]],
  ['fideos', 'Fideos, Arroz y Legumbres', '🍝', [
    'fideos|Fideos|🍝|g|gluten|Spaghetti 5,Corbatas,Tallarín,Espirales,Rigatoni,Cabellos de ángel,Lasaña,Integrales,Sin gluten:-gluten',
    'arroz|Arroz|🍚|g|-|Grado 1,Pregraneado,Integral,Basmati,Para sushi,Jazmín,Arborio',
    'lenteja|Lentejas|🫘|g|-|6 mm,4 mm,Roja,Cocidas en lata',
    'poroto|Porotos|🫘|g|-|Hallado,Tórtola,Negro,Coscorrón,Cocidos en lata',
    'garbanzo|Garbanzos|🫘|g|-|Secos,Cocidos en lata',
    'arveja|Arvejas|🫛|g|-|Partidas,Congeladas',
    'harina|Harina|🌾|g|gluten|Sin polvos,Con polvos,Integral,Sin gluten:-gluten,Maicena:-gluten,De almendras:-gluten+frutos_secos',
    'avena|Avena|🥣|g|gluten|Tradicional,Instantánea,Sin gluten:-gluten',
    'semola|Sémola|🥣|g|gluten|Normal',
    'mote|Mote|🌾|g|gluten|Trigo',
    'cuscus|Cuscús|🍚|g|gluten|Normal',
    'chuchoca|Chuchoca|🌽|g|-|Normal',
    'pure|Puré instantáneo|🥔|g|lactosa+sodio|Normal',
    'pastafresca|Pasta fresca|🥟|g|gluten+huevo+lactosa|Ravioles de carne:+carne,Ravioles de ricota,Ñoquis:-huevo-lactosa,Sorrentinos,Capeletis',
    'harinatostada|Harina tostada|🌾|g|gluten|Trigo',
    'polenta|Polenta|🌽|g|-|Instantánea,Tradicional',
    'panrallado|Pan rallado|🍞|g|gluten|Normal,Panko,Sin gluten:-gluten',
    'fideosarroz|Fideos de arroz|🍜|g|-|Finos,Planos',
    'cremasobre|Crema / sopa en sobre|🥣|un|gluten+sodio|Espárragos,Champiñón,Zapallo,Pollo,Verduras,Sin gluten:-gluten',
  ]],
  ['aceites', 'Aceites y Condimentos', '🫒', [
    'aceite|Aceite|🫒|un/1L|-|Maravilla,Oliva extra virgen,Canola,Vegetal,Spray,Coco',
    'vinagre|Vinagre|🫙|ml|-|Blanco,Manzana,Balsámico,Vino tinto,Arroz',
    'sal|Sal|🧂|g|sodio|Fina,Gruesa,De mar,Lobos',
    'azucar|Azúcar|🍬|g|azucar|Blanca,Rubia,Flor,Sucralosa:-azucar,Stevia:-azucar',
    'pimienta|Pimienta|⚫|g|-|Negra molida,Grano,Blanca',
    'oregano|Orégano|🌿|g|-|Seco',
    'comino|Comino|🌿|g|-|Molido',
    'merken|Merkén|🌶️|g|-|Ahumado',
    'paprika|Ají de color|🌶️|g|-|Ají de color,Paprika',
    'laurel|Laurel|🍃|g|-|Hojas',
    'ajopolvo|Ajo en polvo|🧄|g|-|Normal',
    'alino|Aliño completo|🧂|g|sodio|Normal',
    'caldo|Caldo|🥣|un|gluten+sodio|Cubo carne,Cubo pollo,Cubo verduras,En polvo,Sin gluten:-gluten',
    'mayonesa|Mayonesa|🥚|g|huevo+grasas|Tradicional,Light,Casera,Vegana:-huevo',
    'ketchup|Ketchup|🍅|g|azucar|Normal,Sin azúcar:-azucar',
    'mostaza|Mostaza|🟡|g|-|Amarilla,Dijon,Antigua',
    'salsasoya|Salsa de soya|🥢|ml|soya+gluten+sodio|Normal,Baja en sodio,Tamari sin gluten:-gluten',
    'salsatomate|Salsa de tomate|🥫|g|-|Pomarola,Natural,Italiana,Tomate triturado',
    'pesto|Pesto|🌿|g|lactosa+frutos_secos|Albahaca,Vegano:-lactosa',
    'curry|Curry|🍛|g|-|En polvo,Pasta roja,Pasta verde',
    'manteca|Manteca|🧈|g|grasas|De cerdo:+cerdo,Vegetal',
    'salsainglesa|Salsa inglesa|🫙|ml|sodio+pescado|Normal',
    'salsabbq|Salsa BBQ|🍖|g|azucar+sodio|Normal,Picante',
    'chimichurri|Chimichurri|🌿|g|-|Seco,En aceite',
    'especias|Especias|🧂|g|-|Cúrcuma,Nuez moscada,Tomillo seco,Romero seco,Clavo de olor,Jengibre en polvo,Ciboulette seco,Hierbas provenzales',
    'pastaaji|Pasta de ají|🌶️|g|sodio|Ají verde,Ají amarillo,Ají rojo',
    'aderezo|Aderezos para ensalada|🥗|ml|-|César:+lactosa+huevo,Mil islas:+huevo,Mostaza miel:+azucar,Vinagreta',
  ]],
  ['desayuno', 'Desayuno y Panadería', '🥐', [
    'pan|Pan|🍞|un|gluten|Marraqueta,Hallulla,Dobladita,Frica,Molde blanco,Molde integral,Integral,Amasado,Copihue (completo),Hamburguesa,Pita,Baguette,Sin gluten:-gluten',
    'tortilla|Tortillas|🫓|un|gluten|Trigo,Maíz:-gluten,Integral',
    'cafe|Café|☕|g|-|Instantáneo,Molido,Grano,Cápsulas,Descafeinado',
    'te|Té|🍵|un|-|Negro,Verde,Rojo,Hierbas,Manzanilla',
    'cereal|Cereal|🥣|g|gluten+azucar|Corn flakes,Granola:+frutos_secos,Muesli,Chocolate,Sin gluten:-gluten',
    'mermelada|Mermelada|🍓|g|azucar|Frutilla,Damasco,Mora,Sin azúcar:-azucar',
    'mantequillamani|Mantequilla de maní|🥜|g|mani|Cremosa,Crunchy',
    'miel|Miel|🍯|g|miel+azucar|Ulmo,Multiflora',
    'galletasagua|Galletas de agua|🍘|un|gluten|Soda,Integral,De arroz:-gluten',
    'tostadas|Tostadas|🍞|un|gluten|Integrales,De arroz:-gluten',
    'cacaopolvo|Cacao en polvo|🍫|g|azucar|Chocolatado,Cacao amargo:-azucar',
    'yerbamate|Yerba mate|🧉|g|-|Tradicional,Compuesta,Despalada',
    'cremaavellana|Crema de avellana|🍫|g|frutos_secos+lactosa+azucar+grasas|Normal',
    'pasteleria|Pastelería|🍰|un|gluten+azucar+huevo+lactosa|Queque,Kuchen,Berlín,Torta,Brazo de reina,Pan de pascua,Calzones rotos',
    'masas|Masas y tortillas|🫓|un|gluten|Masa empanada horno,Masa empanada fritura,Masa de hojaldre:+grasas,Masa pizza,Masa wantán,Tortilla de rescoldo',
    'galletasalada|Galletas saladas|🍘|un|gluten+sodio|Cracker,Salada,Integral,Sin gluten:-gluten',
  ]],
  ['bebestibles', 'Bebestibles', '🧃', [
    'agua|Agua|💧|un|-|Sin gas 1.6 L,Con gas 1.6 L,Bidón 6 L,Saborizada',
    'bebida|Bebida|🥤|un|azucar|Cola 3 L,Cola zero:-azucar,Naranja,Limón,Ginger ale,Tónica',
    'jugo|Jugo|🧃|un|azucar|Néctar naranja,Néctar durazno,Polvo sobre,Natural exprimido,Sin azúcar:-azucar',
    'lechevegetal|Bebida vegetal|🥛|un/1L|-|Almendra:+frutos_secos,Avena:+gluten,Soya:+soya,Coco,Arroz',
    'energetica|Bebida energética|⚡|un|azucar|Normal,Zero:-azucar',
    'isotonica|Isotónica|🥤|un|azucar|Normal',
    'infusionfria|Infusiones frías / té helado|🧋|un|azucar|Té helado limón,Durazno,Kombucha:-azucar,Sin azúcar:-azucar',
    'suero|Suero oral|💧|un|-|Normal,Sabor',
    'jarabe|Jarabe y concentrado|🍹|ml|azucar|Granadina,Sour,Concentrado de frutas',
  ]],
  ['alcoholes', 'Alcoholes', '🍷', [
    'cerveza|Cerveza|🍺|un|alcohol+gluten|Lager lata,Lager botella,IPA,Stout,Sin alcohol:-alcohol,Sin gluten:-gluten',
    'vino|Vino|🍷|un|alcohol|Tinto Cabernet,Tinto Carmenere,Blanco Sauvignon,Rosé,Espumante,Caja 2 L',
    'pisco|Pisco|🍸|un|alcohol|35°,40°,Sour preparado:+azucar',
    'ron|Ron|🥃|un|alcohol|Blanco,Añejo',
    'whisky|Whisky|🥃|un|alcohol|Normal',
    'vodka|Vodka|🍸|un|alcohol|Normal',
    'gin|Gin|🍸|un|alcohol|Normal',
    'aperitivo|Aperitivo|🍹|un|alcohol|Fernet,Aperol,Ramazzotti',
    'sidra|Sidra|🍾|un|alcohol|Manzana,Pera',
    'chicha|Chicha|🍶|un|alcohol+azucar|Manzana,Uva',
    'licor|Licores|🍸|un|alcohol+azucar|Araucano,Menta,Amaretto:+frutos_secos,Crema irlandesa:+lactosa,Licor de café',
    'tequila|Tequila|🥃|un|alcohol|Blanco,Reposado',
    'coctel|Cócteles listos / spritz|🍹|un|alcohol+azucar|Piscola lata,Spritz,Mojito,Sour lata',
  ]],
  ['congelados', 'Congelados', '🧊', [
    'helado|Helado|🍨|un|lactosa+azucar+grasas|Vainilla 1 L,Chocolate 1 L,Paletas,Sin lactosa:-lactosa',
    'verdurascong|Verduras congeladas|🥦|g|-|Mix primavera,Choclo,Porotos verdes,Espinaca,Mix salteado',
    'papasfritas|Papas prefritas|🍟|g|grasas|Corte recto,Rústicas,Noisette',
    'empanada|Empanadas congeladas|🥟|un|gluten+lactosa+grasas|Queso,Pino:+carne,Napolitana',
    'pizza|Pizza congelada|🍕|un|gluten+lactosa+grasas|Margarita,Pepperoni:+carne+cerdo,Vegetariana',
    'nuggets|Nuggets|🍗|g|carne+gluten+grasas|Pollo,Vegetales:-carne+soya',
    'frutacong|Fruta congelada|🍓|g|-|Frutilla,Berries mix,Mango,Frambuesa',
    'hielo|Hielo|🧊|un|-|Bolsa 2 kg',
    'platoscong|Comidas congeladas|🍱|un|sodio|Lasaña:+gluten+lactosa+carne,Pastel de choclo:+carne,Arroz chaufa:+soya+gluten,Cazuela:+carne,Empanadas de queso:+gluten+lactosa',
    'apanados|Apanados|🍤|g|gluten+grasas|Pescado apanado:+pescado,Pollo apanado:+carne,Camarón apanado:+mariscos,Vegetales',
    'pulpas|Pulpas de fruta|🥭|g|-|Frutilla,Mango,Maracuyá,Frambuesa,Mora',
  ]],
  ['snacks', 'Snacks y Dulces', '🍫', [
    'papaschips|Papas fritas (snack)|🥔|g|sodio+grasas|Corrientes,Onduladas,Al hilo',
    'galletas|Galletas|🍪|un|gluten+azucar|Rellenas chocolate,De vino,Mantequilla:+lactosa,Avena,Sin gluten:-gluten',
    'chocolate|Chocolate|🍫|g|lactosa+azucar+grasas|De leche,Amargo 70%:-lactosa,Blanco,Con almendras:+frutos_secos',
    'frutossecos|Frutos secos|🥜|g|frutos_secos|Almendras,Nueces,Maní:-frutos_secos+mani,Mix,Pistachos,Castañas de cajú',
    'frutadeshid|Fruta deshidratada|🍑|g|azucar|Pasas,Huesillos,Ciruelas,Descarozados',
    'ramitas|Ramitas|🥨|g|gluten+sodio|Original,Queso:+lactosa',
    'cabritas|Cabritas|🍿|g|-|Microondas,Dulces:+azucar',
    'caramelos|Caramelos|🍬|g|azucar|Surtidos,Gomitas,Chicles',
    'barras|Barras de cereal|🍫|un|gluten+azucar|Avena,Proteína,Frutos secos:+frutos_secos',
    'nachos|Nachos|🌮|g|sodio+grasas|Natural,Queso:+lactosa',
    'alfajor|Alfajores|🍪|un|gluten+lactosa+azucar+grasas|Chocolate,Manjar,Sin gluten:-gluten',
    'wafer|Barquillos y wafer|🧇|un|gluten+azucar|Chocolate,Vainilla,Frutilla',
    'suflitos|Suflés de maíz|🌽|g|sodio|Queso:+lactosa,Natural',
    'mani|Maní salado|🥜|g|mani+sodio|Salado,Confitado:+azucar-sodio,Japonés:+gluten+soya',
    'chicle|Chicles y mentas|🍬|un|-|Sin azúcar,Pastillas de menta',
    'pastacoctel|Pastas para cóctel y untables|🫕|g|-|Paté de ave:+carne,Guacamole,Salsa queso:+lactosa,Ají pebre',
  ]],
  ['conservas', 'Conservas y Salsas', '🥫', [
    'atun|Atún|🐟|un|pescado|En agua,En aceite,Lomitos',
    'jurel|Jurel|🐟|un|pescado|Natural,En salsa de tomate',
    'choclolata|Choclo en lata|🌽|un|-|Grano,Crema',
    'champilata|Champiñones en lata|🍄|un|-|Laminados,Enteros',
    'aceitunas|Aceitunas|🫒|g|sodio|Negras Azapa,Verdes,Sin carozo',
    'tomatelata|Tomates en lata|🥫|un|-|Pelados,Triturados,Pasta de tomate',
    'palmitos|Palmitos|🌴|un|-|Enteros,Rodajas',
    'duraznoconserva|Duraznos en conserva|🍑|un|azucar|Mitades,Light:-azucar',
    'encurtidos|Encurtidos|🥒|un|sodio|Pepinillos,Cebollitas,Chucrut',
    'salsapicante|Salsa picante|🌶️|ml|-|Tabasco,Sriracha,Pebre',
    'sopa|Sopa instantánea|🍜|un|gluten+sodio|Pollo,Carne,Verduras,Ramen',
    'sardinas|Sardinas|🐟|un|pescado+sodio+purinas|En aceite,En salsa de tomate',
    'mariscolata|Mariscos en conserva|🦪|un|mariscos+sodio+purinas|Choritos,Machas,Almejas,Ostiones',
    'verdurascons|Verduras en conserva|🥫|un|sodio|Arvejas,Porotos verdes,Jardinera,Alcachofas,Espárragos,Pimentón',
    'frutacons|Frutas en conserva|🍐|un|azucar|Piña,Cóctel de frutas,Peras,Guindas',
    'legumbreslata|Legumbres listas|🫘|un|sodio|Porotos con riendas,Lentejas listas,Garbanzos listos',
  ]],
  ['aseo', 'Aseo y Limpieza', '🧽', [
    'lavaloza|Lavaloza|🧽|un|-|Líquido,Gel,Doypack,Repuesto,Concentrado',
    'detergente|Detergente|🧺|un|-|Líquido,Polvo,Cápsulas,Ropa de color,Ropa delicada',
    'suavizante|Suavizante|🧺|un|-|Normal,Concentrado,Hipoalergénico',
    'cloro|Cloro|🧴|un|-|Tradicional,Gel,Tabletas',
    'limpiapisos|Limpiapisos|🧴|un|-|Lavanda,Floral,Madera',
    'multiuso|Limpiador multiuso|🧴|un|-|Spray,Desengrasante,Baño,Vidrios',
    'esponja|Esponjas y paños|🧽|un|-|Doble uso,Acero,Paño multiuso',
    'bolsabasura|Bolsas de basura|🗑️|un|-|50x70,80x110,Con aroma',
    'papelhig|Papel higiénico|🧻|un|-|Doble hoja,Hoja simple,Triple hoja',
    'toallapapel|Toalla de papel|🧻|un|-|Normal,Jumbo',
    'servilletas|Servilletas|🧻|un|-|Normales,Cóctel',
    'lavavajillas|Pastillas lavavajillas|🍽️|un|-|Todo en 1',
    'ambiental|Desodorante ambiental|🌸|un|-|Spray,Difusor,Automático',
    'insecticida|Insecticida|🪰|un|-|Spray,Enchufable',
    'guantes|Guantes de aseo|🧤|un|-|Talla M,Talla L',
    'quitamanchas|Quitamanchas|🧺|un|-|Líquido,Polvo,Barra',
    'cera|Cera y abrillantador|✨|un|-|Cera piso,Lustramuebles,Limpia acero',
    'escoba|Escoba y trapero|🧹|un|-|Escoba,Trapero,Mopa,Pala,Repuesto mopa',
    'estanque|Pastilla estanque WC|🚽|un|-|Azul,Cloro',
    'panococina|Paños de cocina|🧽|un|-|Absorbente,Microfibra',
    'antisarro|Antisarro y destapador|🧴|un|-|Antisarro,Destapa cañerías',
  ]],
  ['personal', 'Cuidado Personal y Salud', '🧴', [
    'shampoo|Shampoo|🧴|un|-|Normal,Anticaspa,Rulos,Bebé,Sólido',
    'acondicionador|Acondicionador|🧴|un|-|Normal,Reparación',
    'jabon|Jabón|🧼|un|-|Barra,Líquido,Repuesto,Antibacterial',
    'pastadental|Pasta dental|🦷|un|-|Blanqueadora,Sensibilidad,Niños',
    'cepillo|Cepillo de dientes|🪥|un|-|Suave,Medio,Repuesto eléctrico',
    'desodorante|Desodorante|🧴|un|-|Spray,Roll-on,Barra',
    'afeitar|Máquina de afeitar|🪒|un|-|Desechable,Repuesto',
    'toallasfem|Higiene femenina|🌸|un|-|Toallas normales,Toallas nocturnas,Protector diario,Tampones',
    'algodon|Algodón|☁️|un|-|Discos,Motas,Cotonitos',
    'bloqueador|Bloqueador solar|🧴|un|-|FPS 50,FPS 30,Niños',
    'paracetamol|Paracetamol|💊|un|-|500 mg,1 g',
    'ibuprofeno|Ibuprofeno|💊|un|-|400 mg,600 mg',
    'vitaminas|Vitaminas|💊|un|-|Vitamina C,Vitamina D,Multivitamínico,Magnesio',
    'botiquin|Botiquín|🩹|un|-|Parches curitas,Alcohol gel,Alcohol 70%,Gasa',
    'cremacorporal|Crema corporal y facial|🧴|un|-|Corporal,Facial,Manos,Protector labial',
    'enjuague|Enjuague bucal e hilo dental|🦷|un|-|Enjuague,Hilo dental,Cepillo interdental',
    'panaladulto|Incontinencia adulto|🩲|un|-|Pañal adulto,Apósito,Ropa interior',
    'intimo|Bienestar íntimo|❤️|un|-|Preservativos,Lubricante',
    'depilacion|Depilación|🪒|un|-|Cera,Crema depilatoria,Máquina mujer',
    'accesmedicos|Accesorios médicos|🩺|un|-|Termómetro,Mascarillas,Suero fisiológico,Test antígeno',
  ]],
  ['mascotas', 'Mascotas', '🐾', [
    'alimperro|Alimento perro|🐶|kg|-|Adulto,Cachorro,Senior,Raza pequeña,Húmedo (sobre)',
    'alimgato|Alimento gato|🐱|kg|-|Adulto,Gatito,Esterilizado,Húmedo (sobre)',
    'arena|Arena sanitaria|🪣|kg|-|Aglomerante,Sílica,Biodegradable',
    'snackmascota|Snacks mascota|🦴|un|-|Huesos,Premios',
    'antipulgas|Antiparasitario|💊|un|-|Pipeta,Comprimido,Collar',
    'otrasmascotas|Otras mascotas|🐦|un|-|Alimento aves,Alimento peces,Alimento roedores,Viruta',
    'higienemascota|Higiene mascotas|🐾|un|-|Bolsas para fecas,Pañales perro,Shampoo mascota',
  ]],
  ['reposteria', 'Repostería', '🧁', [
    'polvohornear|Polvos de hornear|🧁|g|-|Normal',
    'levadura|Levadura|🍞|g|-|Seca instantánea,Fresca',
    'vainilla|Esencia de vainilla|🌼|ml|-|Normal',
    'cacao|Cacao amargo|🍫|g|-|Normal',
    'chips|Chips de chocolate|🍫|g|lactosa+azucar|Semi amargo,Blanco',
    'canela|Canela|🟤|g|-|Molida,Rama',
    'gelatina|Gelatina|🍮|un|azucar|Frutilla,Frambuesa,Sin sabor:-azucar,Light:-azucar',
    'coco|Coco rallado|🥥|g|-|Normal',
    'colorante|Colorante|🎨|ml|-|Rojo,Azul,Verde',
    'premezcla|Premezcla|🎂|un|gluten+azucar|Queque,Brownie,Panqueques,Sin gluten:-gluten',
    'chuno|Chuño / fécula|🥄|g|-|Normal',
    'bicarbonato|Bicarbonato|🧂|g|-|Normal',
    'cobertura|Cobertura de chocolate|🍫|g|lactosa+azucar|Semiamarga,Blanca,Leche',
    'decoraciones|Decoraciones|✨|g|azucar|Mostacillas,Chispas de colores,Fondant,Velas de cumpleaños:-azucar',
    'postrepolvo|Postres en polvo|🍮|un|azucar+lactosa|Flan,Leche asada,Sémola con leche,Mousse,Crema pastelera',
    'cremachantilly|Crema chantilly en polvo|🍦|un|azucar+lactosa|Normal',
  ]],
  ['bebe', 'Bebé', '🍼', [
    'panales|Pañales|👶|un|-|RN,P,M,G,XG,XXG,Pants',
    'toallitas|Toallitas húmedas|🧻|un|-|Normal,Sin fragancia',
    'formula|Fórmula infantil|🍼|un|lactosa|Etapa 1,Etapa 2,Etapa 3,Sin lactosa:-lactosa',
    'compota|Compota|🍎|un|-|Manzana,Pera,Mix frutas',
    'cremabebe|Crema coceduras|🧴|un|-|Normal',
  ]],
  ['fiambreria', 'Fiambrería', '🥓', [
    'jamon|Jamón|🍖|g|carne+cerdo+sodio|Pierna,Acaramelado,De pavo:-cerdo,Serrano:+crudo,Sándwich',
    'salame|Salame|🍖|g|carne+cerdo+sodio+grasas+crudo|Italiano,Ahumado',
    'mortadela|Mortadela|🍖|g|carne+cerdo+sodio+grasas|Lisa,Con aceitunas',
    'tocino|Tocino|🥓|g|carne+cerdo+sodio+grasas|Ahumado,Laminado',
    'pate|Paté|🥫|un|carne+cerdo+sodio+grasas+crudo|Tradicional,De ave:-cerdo',
    'arrollado|Arrollado|🥓|g|carne+cerdo+sodio+grasas|Huaso,Malaya,De pollo:-cerdo',
    'fiambres|Otros fiambres|🍖|g|carne+sodio|Lomito ahumado:+cerdo,Pechuga de pavo,Queso de cabeza:+cerdo+grasas,Pastrami',
  ]],
  ['saludable', 'Saludable y Mundo', '🥗', [
    'quinoa|Quinoa|🌾|g|-|Blanca,Roja,Tricolor',
    'tofu|Tofu|🧈|g|soya|Firme,Sedoso,Ahumado',
    'chia|Chía|⚫|g|-|Normal',
    'linaza|Linaza|🟤|g|-|Entera,Molida',
    'proteina|Proteína en polvo|💪|g|lactosa|Whey,Vegana:-lactosa+soya',
    'hummus|Hummus|🫘|g|-|Clásico,Pimentón',
    'nori|Alga nori|🟩|un|-|Láminas',
    'lechecoco|Leche de coco|🥥|ml|-|Lata',
    'semillas|Semillas|🌻|g|-|Zapallo,Maravilla,Sésamo,Mix semillas',
    'seitan|Seitán y proteína vegetal|🌱|g|gluten|Seitán,Proteína texturizada de soya:-gluten+soya',
    'endulzante|Endulzante líquido|💧|ml|-|Sucralosa,Stevia,Monk fruit',
    'granola|Granola sin azúcar|🥣|g|gluten+frutos_secos|Natural,Sin gluten:-gluten',
  ]],
  ['hogar', 'Hogar y Desechables', '🏠', [
    'fosforos|Fósforos y encendedor|🔥|un|-|Fósforos,Encendedor',
    'pilas|Pilas|🔋|un|-|AA,AAA,9V,Recargables',
    'ampolleta|Ampolletas|💡|un|-|LED cálida,LED fría',
    'desechables|Desechables|🥤|un|-|Vasos,Platos,Cubiertos,Bombillas',
    'alusa|Film y aluminio|📜|un|-|Film plástico,Papel aluminio,Papel mantequilla',
    'bolsasherm|Bolsas herméticas|🛍️|un|-|Pequeñas,Medianas,Grandes',
    'carbon|Carbón y leña|🔥|kg|-|Carbón,Briquetas,Leña',
    'gas|Gas licuado|🔥|un|-|Balón 15 kg,Balón 11 kg,Balón 5 kg',
    'velas|Velas|🕯️|un|-|Normales,Aromáticas,Emergencia',
    'bolsacompra|Bolsas reutilizables|🛍️|un|-|Tela,Malla',
    'filtrocafe|Filtros de café|☕|un|-|N°2,N°4',
    'utiles|Librería básica|✏️|un|-|Cuaderno,Lápices,Cinta adhesiva,Pegamento',
  ]],
  ['preparados', 'Comidas preparadas', '🍱', [
    'empanadahorno|Empanadas listas|🥟|un|gluten|Pino:+carne+huevo,Queso:+lactosa,Napolitana:+lactosa+cerdo,Camarón queso:+mariscos+lactosa',
    'sandwich|Sándwiches listos|🥪|un|gluten|Ave palta:+carne,Jamón queso:+carne+cerdo+lactosa,Vegetariano',
    'ensaladaprep|Ensaladas preparadas|🥗|un|-|César:+lactosa+gluten,Chilena,Quinoa,Surtida',
    'pascualina|Pascualinas y quiches|🥧|un|gluten+huevo+lactosa|Espinaca,Jamón queso:+carne+cerdo,Champiñón',
    'polloasado|Pollo asado|🍗|un|carne|Entero,Medio,Con papas fritas:+grasas',
    'sushilisto|Sushi listo|🍣|un|pescado+soya+gluten+crudo|Roll salmón,Roll vegetariano:-pescado-crudo,Hot roll:+grasas',
  ]],
];

/* ---------- Dietas ---------- */
// kind: 'dieta' (preferencias y alergias: prohíbe) | 'salud' (condiciones: prohíbe "no" y advierte "warn")
const DIETS = {
  celiaco:        { kind: 'dieta', name: 'Celíaco / sin gluten', emoji: '🌾', no: ['gluten'] },
  sin_lactosa:    { kind: 'dieta', name: 'Sin lactosa',          emoji: '🥛', no: ['lactosa'] },
  vegetariano:    { kind: 'dieta', name: 'Vegetariano',          emoji: '🥕', no: ['carne', 'cerdo', 'pescado', 'mariscos'] },
  vegano:         { kind: 'dieta', name: 'Vegano',               emoji: '🌱', no: ['carne', 'cerdo', 'pescado', 'mariscos', 'lactosa', 'huevo', 'miel'] },
  frutos_secos:   { kind: 'dieta', name: 'Alergia frutos secos', emoji: '🥜', no: ['frutos_secos', 'mani'] },
  mariscos:       { kind: 'dieta', name: 'Alergia mariscos',     emoji: '🦐', no: ['mariscos'] },
  huevo:          { kind: 'dieta', name: 'Alergia al huevo',     emoji: '🥚', no: ['huevo'] },
  soya:           { kind: 'dieta', name: 'Alergia a la soya',    emoji: '🫘', no: ['soya'] },
  sin_cerdo:      { kind: 'dieta', name: 'Sin cerdo',            emoji: '🐖', no: ['cerdo'] },
  sin_alcohol:    { kind: 'dieta', name: 'Sin alcohol',          emoji: '🚫', no: ['alcohol'] },
  diabetico:      { kind: 'salud', name: 'Diabetes',             emoji: '🩸', no: ['azucar'], warn: ['miel'] },
  hipertension:   { kind: 'salud', name: 'Hipertensión',         emoji: '🩺', warn: ['sodio'] },
  colesterol:     { kind: 'salud', name: 'Colesterol alto',      emoji: '🫀', warn: ['grasas'] },
  gota:           { kind: 'salud', name: 'Gota / ácido úrico',   emoji: '🦶', warn: ['purinas', 'alcohol'] },
  renal:          { kind: 'salud', name: 'Enfermedad renal',     emoji: '💧', warn: ['sodio', 'purinas'] },
  embarazo:       { kind: 'salud', name: 'Embarazo',             emoji: '🤰', no: ['alcohol'], warn: ['crudo'] },
  gastritis:      { kind: 'salud', name: 'Gastritis / reflujo',  emoji: '🔥', warn: ['grasas', 'alcohol'] },
};
const TAG_NAMES = {
  gluten: 'gluten', lactosa: 'lactosa', huevo: 'huevo', carne: 'carne', cerdo: 'cerdo',
  pescado: 'pescado', mariscos: 'mariscos', frutos_secos: 'frutos secos', mani: 'maní',
  soya: 'soya', alcohol: 'alcohol', azucar: 'azúcar', miel: 'miel',
  sodio: 'alto en sodio', grasas: 'grasas saturadas', purinas: 'purinas', crudo: 'crudo o curado',
};
const ALLERGEN_TAGS = ['gluten', 'lactosa', 'huevo', 'carne', 'cerdo', 'pescado', 'mariscos', 'frutos_secos', 'mani', 'soya', 'alcohol', 'azucar', 'miel'];

function slug(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

const Catalog = (() => {
  const cats = [];
  const byId = {};      // itemId -> {c, item}
  const catById = {};

  function parseUnit(spec) {
    const [u, size] = spec.split('/');
    let sz = null;
    if (size) {
      const m = size.match(/^([\d.]+)\s*(g|kg|ml|L)$/);
      if (m) sz = { q: parseFloat(m[1]), u: m[2] };
    }
    return { u, size: sz };
  }

  function parseVariants(str, baseTags) {
    if (!str) return [];
    return str.split(',').map(s => s.trim()).filter(Boolean).map(raw => {
      const [name, mods] = raw.split(':');
      const tags = new Set(baseTags);
      if (mods) (mods.match(/[+-][a-z_]+/g) || []).forEach(m => {
        if (m[0] === '+') tags.add(m.slice(1)); else tags.delete(m.slice(1));
      });
      return { id: slug(name), name: name.trim(), tags: [...tags] };
    });
  }

  CATALOG_RAW.forEach(([id, name, emoji, items]) => {
    const cat = { id, name, emoji, items: [] };
    items.forEach(line => {
      const [iid, iname, iemoji, unit, tagStr, vars] = line.split('|');
      const tags = tagStr && tagStr !== '-' ? tagStr.split('+') : [];
      const { u, size } = parseUnit(unit);
      const item = { id: iid, name: iname, emoji: iemoji, u, size, tags, vars: parseVariants(vars, tags) };
      cat.items.push(item);
      byId[iid] = { c: id, item };
    });
    cats.push(cat);
    catById[id] = cat;
  });

  const st = () => (typeof Store !== 'undefined' && Store.state) ? Store.state.shop : { custom: {}, extraVar: {} };

  function customList() {
    return Object.entries(st().custom || {}).filter(([, x]) => x && !x.del).map(([k, x]) => ({ key: k, ...x }));
  }

  function item(c, i) {
    const b = byId[i];
    if (b && b.c === c) return b.item;
    const cu = (st().custom || {})[c + '|' + i];
    if (cu && !cu.del) {
      return {
        id: i, name: cu.name, emoji: cu.emoji || '📦', u: cu.u || 'un', size: null, tags: cu.tags || [], custom: true,
        vars: [],
      };
    }
    if (b) return b.item;
    return { id: i, name: i, emoji: '📦', u: 'un', size: null, tags: [], vars: [] };
  }

  function variants(c, i) {
    const it = item(c, i);
    const extra = (st().extraVar || {})[c + '|' + i] || [];
    const list = it.vars.slice();
    extra.forEach(name => {
      const id = slug(name);
      if (!list.some(v => v.id === id)) list.push({ id, name, tags: it.tags.slice(), extra: true });
    });
    return list;
  }

  function variant(c, i, v) {
    if (!v) return null;
    return variants(c, i).find(x => x.id === v) || { id: v, name: v, tags: item(c, i).tags };
  }

  function tags(c, i, v) {
    const vv = variant(c, i, v);
    return vv ? vv.tags : item(c, i).tags;
  }

  function label(c, i, v) {
    const it = item(c, i);
    const vv = variant(c, i, v);
    return vv ? `${it.name} · ${vv.name}` : it.name;
  }

  function cat(c) {
    return catById[c] || { id: c, name: 'Otros', emoji: '📦', items: [] };
  }

  function allCats() {
    // incluye ítems personalizados en su categoría
    const custom = customList();
    return cats.map(ct => {
      const extra = custom.filter(x => x.key.split('|')[0] === ct.id).map(x => item(ct.id, x.key.split('|')[1]));
      return extra.length ? { ...ct, items: [...ct.items, ...extra] } : ct;
    });
  }

  function norm(s) { return slug(s).replace(/-/g, ' '); }

  function search(q) {
    const nq = norm(q);
    if (!nq) return [];
    const out = [];
    allCats().forEach(ct => ct.items.forEach(it => {
      const hay = norm(it.name);
      const vhit = variants(ct.id, it.id).filter(v => norm(v.name).includes(nq));
      if (hay.includes(nq) || vhit.length) out.push({ c: ct.id, item: it, score: hay.startsWith(nq) ? 0 : hay.includes(nq) ? 1 : 2, vhit });
    }));
    return out.sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name)).slice(0, 40);
  }

  function find(itemId) { return byId[itemId] || null; }

  return { cats: allCats, cat, item, variants, variant, tags, label, search, find, customList, slug };
})();

/* ---------- Motor de dietas ---------- */
const Diet = {
  info(member) { return (Store.state.household.diets || {})[member] || { tags: [], note: '', items: [] }; },
  forbidden(member) {
    const set = new Set();
    (Diet.info(member).tags || []).forEach(t => ((DIETS[t] && DIETS[t].no) || []).forEach(x => set.add(x)));
    return [...set];
  },
  cautionTags(member) {
    const set = new Set();
    (Diet.info(member).tags || []).forEach(t => ((DIETS[t] && DIETS[t].warn) || []).forEach(x => set.add(x)));
    return [...set];
  },
  bannedItems(member) { return Diet.info(member).items || []; },
  // Qué condición explica una etiqueta de precaución
  condFor(member, tag) {
    const k = (Diet.info(member).tags || []).find(t => DIETS[t] && (DIETS[t].warn || []).includes(tag));
    return k ? DIETS[k].name : '';
  },
  // Prohibiciones: [{member, tags:[...], item:bool}]
  conflicts(c, i, v, members) {
    const tg = Catalog.tags(c, i, v);
    const out = [];
    (members || Store.state.household.members).forEach(m => {
      const bad = Diet.forbidden(m).filter(t => tg.includes(t));
      const item = Diet.bannedItems(m).includes(i);
      if (bad.length || item) out.push({ member: m, tags: bad, item });
    });
    return out;
  },
  // Precauciones de salud: [{member, tags:[...], conds:[...]}]
  cautions(c, i, v, members) {
    const tg = Catalog.tags(c, i, v);
    const out = [];
    (members || Store.state.household.members).forEach(m => {
      const bad = Diet.cautionTags(m).filter(t => tg.includes(t));
      if (bad.length) out.push({ member: m, tags: bad, conds: [...new Set(bad.map(t => Diet.condFor(m, t)))] });
    });
    return out;
  },
  // Busca una variante del mismo producto que no tenga ninguno de los tags prohibidos
  alt(c, i, v, forbidden, members) {
    if ((members || []).some(m => Diet.bannedItems(m).includes(i))) return null;
    if (!forbidden.length) return v;
    const ok = Catalog.variants(c, i).find(x => !x.tags.some(t => forbidden.includes(t)));
    return ok ? ok.id : null;
  },
  warnText(conf) {
    return conf.map(x => {
      const why = [...(x.tags || []).map(t => TAG_NAMES[t] || t)];
      return `No apto para ${x.member}` + (why.length ? ` — contiene ${why.join(', ')}` : '') + (x.item ? ' — está en su lista de alimentos prohibidos' : '');
    }).join(' · ');
  },
  cautionText(ca) {
    return ca.map(x => `Precaución ${x.member} (${x.conds.join(', ')}): ${x.tags.map(t => TAG_NAMES[t] || t).join(', ')}`).join(' · ');
  },
};

if (typeof module !== 'undefined') module.exports = { Catalog, Diet, DIETS, slug };
