-- RAWAJ Taxonomy, Data & Search Foundation V1: initial vehicle catalog and private review queue.
-- The seed is intentionally extensible. Unknown values enter review instead of becoming permanent free text.

create table if not exists public.vehicle_reference_review_queue (
  id uuid primary key default gen_random_uuid(),
  entity_type text not null,
  parent_make_id text references public.vehicle_makes(id) on delete set null,
  parent_model_id text references public.vehicle_models(id) on delete set null,
  raw_value text not null,
  normalized_value text not null,
  suggested_match_id text,
  listing_id uuid references public.listings(id) on delete set null,
  requested_by uuid references public.profiles(id) on delete set null,
  status text not null default 'pending',
  occurrence_count integer not null default 1,
  review_note text,
  reviewed_by uuid references public.profiles(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint vehicle_reference_review_queue_entity_check check (
    entity_type in ('make', 'model', 'generation', 'trim')
  ),
  constraint vehicle_reference_review_queue_status_check check (
    status in ('pending', 'matched', 'created', 'rejected')
  ),
  constraint vehicle_reference_review_queue_occurrence_check check (occurrence_count > 0),
  constraint vehicle_reference_review_queue_value_check check (
    char_length(btrim(raw_value)) between 1 and 120
    and char_length(btrim(normalized_value)) between 1 and 120
  ),
  constraint vehicle_reference_review_queue_parent_scope_check check (
    (entity_type = 'make' and parent_make_id is null and parent_model_id is null)
    or (entity_type = 'model' and parent_make_id is not null and parent_model_id is null)
    or (entity_type in ('generation', 'trim') and parent_model_id is not null)
  )
);

create unique index if not exists vehicle_reference_review_queue_open_scope_idx
  on public.vehicle_reference_review_queue(
    entity_type,
    coalesce(parent_make_id, ''),
    coalesce(parent_model_id, ''),
    normalized_value
  )
  where status = 'pending';

create index if not exists vehicle_reference_review_queue_status_created_idx
  on public.vehicle_reference_review_queue(status, occurrence_count desc, created_at);

alter table public.vehicle_reference_review_queue enable row level security;
revoke all on table public.vehicle_reference_review_queue from anon, authenticated;

drop trigger if exists vehicle_reference_review_queue_touch_updated_at
  on public.vehicle_reference_review_queue;
create trigger vehicle_reference_review_queue_touch_updated_at
before update on public.vehicle_reference_review_queue
for each row execute function public.rawaj_touch_taxonomy_foundation_updated_at();

insert into public.vehicle_makes (
  id, slug, name_ar, name_en, aliases, country_code, sort_order
)
values
  ('toyota', 'toyota', 'تويوتا', 'Toyota', array['تويوتا','Toyota'], 'JP', 10),
  ('hyundai', 'hyundai', 'هيونداي', 'Hyundai', array['هيونداي','هونداي','Hyundai'], 'KR', 20),
  ('kia', 'kia', 'كيا', 'Kia', array['كيا','Kia'], 'KR', 30),
  ('mercedes-benz', 'mercedes-benz', 'مرسيدس بنز', 'Mercedes-Benz', array['مرسيدس','مرسيدس بنز','Mercedes','Mercedes Benz'], 'DE', 40),
  ('bmw', 'bmw', 'بي إم دبليو', 'BMW', array['بي ام دبليو','BMW'], 'DE', 50),
  ('nissan', 'nissan', 'نيسان', 'Nissan', array['نيسان','Nissan'], 'JP', 60),
  ('honda', 'honda', 'هوندا', 'Honda', array['هوندا','Honda'], 'JP', 70),
  ('ford', 'ford', 'فورد', 'Ford', array['فورد','Ford'], 'US', 80),
  ('chevrolet', 'chevrolet', 'شيفروليه', 'Chevrolet', array['شيفروليه','شفروليه','Chevrolet','Chevy'], 'US', 90),
  ('renault', 'renault', 'رينو', 'Renault', array['رينو','Renault'], 'FR', 100),
  ('peugeot', 'peugeot', 'بيجو', 'Peugeot', array['بيجو','Peugeot'], 'FR', 110),
  ('volkswagen', 'volkswagen', 'فولكس فاغن', 'Volkswagen', array['فولكس فاغن','فولكسفاغن','Volkswagen','VW'], 'DE', 120),
  ('audi', 'audi', 'أودي', 'Audi', array['اودي','أودي','Audi'], 'DE', 130),
  ('mitsubishi', 'mitsubishi', 'ميتسوبيشي', 'Mitsubishi', array['ميتسوبيشي','Mitsubishi'], 'JP', 140),
  ('mazda', 'mazda', 'مازدا', 'Mazda', array['مازدا','Mazda'], 'JP', 150),
  ('suzuki', 'suzuki', 'سوزوكي', 'Suzuki', array['سوزوكي','Suzuki'], 'JP', 160),
  ('chery', 'chery', 'شيري', 'Chery', array['شيري','Chery'], 'CN', 170),
  ('geely', 'geely', 'جيلي', 'Geely', array['جيلي','Geely'], 'CN', 180),
  ('byd', 'byd', 'بي واي دي', 'BYD', array['بي واي دي','BYD'], 'CN', 190),
  ('lexus', 'lexus', 'لكزس', 'Lexus', array['لكزس','ليكسوس','Lexus'], 'JP', 200),
  ('opel', 'opel', 'أوبل', 'Opel', array['اوبل','أوبل','Opel'], 'DE', 210),
  ('fiat', 'fiat', 'فيات', 'Fiat', array['فيات','Fiat'], 'IT', 220),
  ('skoda', 'skoda', 'سكودا', 'Skoda', array['سكودا','Škoda','Skoda'], 'CZ', 230),
  ('seat', 'seat', 'سيات', 'SEAT', array['سيات','Seat','SEAT'], 'ES', 240),
  ('citroen', 'citroen', 'سيتروين', 'Citroen', array['سيتروين','Citroën','Citroen'], 'FR', 250),
  ('daewoo', 'daewoo', 'دايو', 'Daewoo', array['دايو','Daewoo'], 'KR', 260),
  ('dodge', 'dodge', 'دودج', 'Dodge', array['دودج','Dodge'], 'US', 270),
  ('jeep', 'jeep', 'جيب', 'Jeep', array['جيب','Jeep'], 'US', 280),
  ('land-rover', 'land-rover', 'لاند روفر', 'Land Rover', array['لاند روفر','Land Rover','Range Rover','رينج روفر'], 'GB', 290),
  ('gmc', 'gmc', 'جي إم سي', 'GMC', array['جي ام سي','GMC'], 'US', 300),
  ('infiniti', 'infiniti', 'إنفينيتي', 'Infiniti', array['انفينيتي','إنفينيتي','Infiniti'], 'JP', 310),
  ('subaru', 'subaru', 'سوبارو', 'Subaru', array['سوبارو','Subaru'], 'JP', 320),
  ('isuzu', 'isuzu', 'إيسوزو', 'Isuzu', array['ايسوزو','إيسوزو','Isuzu'], 'JP', 330),
  ('volvo', 'volvo', 'فولفو', 'Volvo', array['فولفو','Volvo'], 'SE', 340),
  ('tesla', 'tesla', 'تسلا', 'Tesla', array['تسلا','Tesla'], 'US', 350),
  ('mg', 'mg', 'إم جي', 'MG', array['ام جي','إم جي','MG'], 'GB', 360),
  ('gac', 'gac', 'جي إيه سي', 'GAC', array['جي ايه سي','GAC'], 'CN', 370),
  ('changan', 'changan', 'شانجان', 'Changan', array['شانجان','Changan'], 'CN', 380),
  ('haval', 'haval', 'هافال', 'Haval', array['هافال','Haval'], 'CN', 390),
  ('dongfeng', 'dongfeng', 'دونغ فينغ', 'Dongfeng', array['دونغ فينغ','دونغفنغ','Dongfeng'], 'CN', 400),
  ('lada', 'lada', 'لادا', 'Lada', array['لادا','Lada'], 'RU', 410),
  ('saipa', 'saipa', 'سايبا', 'Saipa', array['سايبا','Saipa'], 'IR', 420),
  ('iran-khodro', 'iran-khodro', 'إيران خودرو', 'Iran Khodro', array['ايران خودرو','إيران خودرو','Iran Khodro','IKCO'], 'IR', 430)
on conflict (id) do update set
  slug = excluded.slug,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  aliases = excluded.aliases,
  country_code = excluded.country_code,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

insert into public.vehicle_models (
  id, make_id, slug, name_ar, name_en, aliases, vehicle_type, sort_order
)
values
  ('toyota-corolla','toyota','corolla','كورولا','Corolla',array['كورولا','Corolla'],'sedan',10),
  ('toyota-camry','toyota','camry','كامري','Camry',array['كامري','كامريه','Kamri','Camry'],'sedan',20),
  ('toyota-yaris','toyota','yaris','يارس','Yaris',array['يارس','Yaris'],'sedan',30),
  ('toyota-land-cruiser','toyota','land-cruiser','لاند كروزر','Land Cruiser',array['لاندكروزر','لاند كروزر','Land Cruiser'],'suv',40),
  ('toyota-prado','toyota','prado','برادو','Prado',array['برادو','Prado'],'suv',50),
  ('toyota-hilux','toyota','hilux','هايلوكس','Hilux',array['هايلوكس','Hilux'],'pickup',60),
  ('toyota-rav4','toyota','rav4','راف 4','RAV4',array['راف4','راف 4','RAV4'],'suv',70),
  ('toyota-fortuner','toyota','fortuner','فورتشنر','Fortuner',array['فورتشنر','Fortuner'],'suv',80),

  ('hyundai-elantra','hyundai','elantra','إلنترا / أفانتي','Elantra',array['النترا','إلنترا','أفانتي','افانتي','Avante','Elantra'],'sedan',10),
  ('hyundai-accent','hyundai','accent','أكسنت','Accent',array['اكسنت','أكسنت','Accent'],'sedan',20),
  ('hyundai-sonata','hyundai','sonata','سوناتا','Sonata',array['سوناتا','Sonata'],'sedan',30),
  ('hyundai-tucson','hyundai','tucson','توسان','Tucson',array['توسان','Tucson'],'suv',40),
  ('hyundai-santa-fe','hyundai','santa-fe','سانتافي','Santa Fe',array['سانتافي','سانتا في','Santa Fe'],'suv',50),
  ('hyundai-i10','hyundai','i10','i10','i10',array['i10','اي 10'],'hatchback',60),
  ('hyundai-i20','hyundai','i20','i20','i20',array['i20','اي 20'],'hatchback',70),
  ('hyundai-h1','hyundai','h1','H1','H-1',array['H1','H-1','اتش 1'],'van',80),

  ('kia-rio','kia','rio','ريو','Rio',array['ريو','Rio'],'sedan',10),
  ('kia-cerato','kia','cerato','سيراتو','Cerato',array['سيراتو','Cerato','Cirato'],'sedan',20),
  ('kia-sportage','kia','sportage','سبورتاج','Sportage',array['سبورتاج','Sportage'],'suv',30),
  ('kia-sorento','kia','sorento','سورينتو','Sorento',array['سورينتو','Sorento'],'suv',40),
  ('kia-picanto','kia','picanto','بيكانتو','Picanto',array['بيكانتو','Picanto'],'hatchback',50),
  ('kia-optima','kia','optima','أوبتيما','Optima',array['اوبتيما','أوبتيما','Optima','K5'],'sedan',60),
  ('kia-carens','kia','carens','كارينز','Carens',array['كارينز','Carens'],'minivan',70),

  ('mercedes-benz-c-class','mercedes-benz','c-class','الفئة C','C-Class',array['C Class','C-Class','سي كلاس'],'sedan',10),
  ('mercedes-benz-e-class','mercedes-benz','e-class','الفئة E','E-Class',array['E Class','E-Class','اي كلاس'],'sedan',20),
  ('mercedes-benz-s-class','mercedes-benz','s-class','الفئة S','S-Class',array['S Class','S-Class','اس كلاس'],'sedan',30),
  ('mercedes-benz-g-class','mercedes-benz','g-class','الفئة G','G-Class',array['G Class','G-Class','جي كلاس','G Wagon'],'suv',40),
  ('mercedes-benz-gle','mercedes-benz','gle','GLE / ML','GLE',array['GLE','ML','ام ال'],'suv',50),
  ('mercedes-benz-sprinter','mercedes-benz','sprinter','سبرنتر','Sprinter',array['سبرنتر','Sprinter'],'van',60),
  ('mercedes-benz-vito','mercedes-benz','vito','فيتو','Vito',array['فيتو','Vito'],'van',70),

  ('bmw-3-series','bmw','3-series','الفئة الثالثة','3 Series',array['3 Series','الفئة 3'],'sedan',10),
  ('bmw-5-series','bmw','5-series','الفئة الخامسة','5 Series',array['5 Series','الفئة 5'],'sedan',20),
  ('bmw-7-series','bmw','7-series','الفئة السابعة','7 Series',array['7 Series','الفئة 7'],'sedan',30),
  ('bmw-x1','bmw','x1','X1','X1',array['X1'],'suv',40),
  ('bmw-x3','bmw','x3','X3','X3',array['X3'],'suv',50),
  ('bmw-x5','bmw','x5','X5','X5',array['X5'],'suv',60),

  ('nissan-sunny','nissan','sunny','صني','Sunny',array['صني','Sunny'],'sedan',10),
  ('nissan-sentra','nissan','sentra','سنترا','Sentra',array['سنترا','Sentra'],'sedan',20),
  ('nissan-altima','nissan','altima','ألتيما','Altima',array['التيما','ألتيما','Altima'],'sedan',30),
  ('nissan-patrol','nissan','patrol','باترول','Patrol',array['باترول','Patrol'],'suv',40),
  ('nissan-x-trail','nissan','x-trail','إكس تريل','X-Trail',array['اكس تريل','إكس تريل','X-Trail'],'suv',50),
  ('nissan-qashqai','nissan','qashqai','قشقاي','Qashqai',array['قشقاي','Qashqai'],'suv',60),
  ('nissan-navara','nissan','navara','نافارا','Navara',array['نافارا','Navara'],'pickup',70),

  ('honda-civic','honda','civic','سيفيك','Civic',array['سيفيك','Civic'],'sedan',10),
  ('honda-accord','honda','accord','أكورد','Accord',array['اكورد','أكورد','Accord'],'sedan',20),
  ('honda-cr-v','honda','cr-v','CR-V','CR-V',array['CRV','CR-V'],'suv',30),
  ('honda-city','honda','city','سيتي','City',array['سيتي','City'],'sedan',40),

  ('ford-focus','ford','focus','فوكس','Focus',array['فوكس','Focus'],'sedan',10),
  ('ford-fusion','ford','fusion','فيوجن','Fusion',array['فيوجن','Fusion'],'sedan',20),
  ('ford-escape','ford','escape','إسكيب','Escape',array['اسكيب','إسكيب','Escape'],'suv',30),
  ('ford-explorer','ford','explorer','إكسبلورر','Explorer',array['اكسبلورر','إكسبلورر','Explorer'],'suv',40),
  ('ford-ranger','ford','ranger','رينجر','Ranger',array['رينجر','Ranger'],'pickup',50),
  ('ford-transit','ford','transit','ترانزيت','Transit',array['ترانزيت','Transit'],'van',60),

  ('chevrolet-cruze','chevrolet','cruze','كروز','Cruze',array['كروز','Cruze'],'sedan',10),
  ('chevrolet-aveo','chevrolet','aveo','أفيو','Aveo',array['افيو','أفيو','Aveo'],'sedan',20),
  ('chevrolet-spark','chevrolet','spark','سبارك','Spark',array['سبارك','Spark'],'hatchback',30),
  ('chevrolet-malibu','chevrolet','malibu','ماليبو','Malibu',array['ماليبو','Malibu'],'sedan',40),
  ('chevrolet-captiva','chevrolet','captiva','كابتيفا','Captiva',array['كابتيفا','Captiva'],'suv',50),
  ('chevrolet-tahoe','chevrolet','tahoe','تاهو','Tahoe',array['تاهو','Tahoe'],'suv',60),
  ('chevrolet-silverado','chevrolet','silverado','سيلفرادو','Silverado',array['سيلفرادو','Silverado'],'pickup',70),

  ('renault-logan','renault','logan','لوغان','Logan',array['لوغان','لوجان','Logan'],'sedan',10),
  ('renault-duster','renault','duster','داستر','Duster',array['داستر','Duster'],'suv',20),
  ('renault-symbol','renault','symbol','سيمبول','Symbol',array['سيمبول','Symbol'],'sedan',30),
  ('renault-megane','renault','megane','ميغان','Megane',array['ميغان','Mégane','Megane'],'sedan',40),
  ('renault-clio','renault','clio','كليو','Clio',array['كليو','Clio'],'hatchback',50),
  ('renault-fluence','renault','fluence','فلوانس','Fluence',array['فلوانس','Fluence'],'sedan',60),

  ('peugeot-206','peugeot','206','206','206',array['206'],'hatchback',10),
  ('peugeot-207','peugeot','207','207','207',array['207'],'hatchback',20),
  ('peugeot-301','peugeot','301','301','301',array['301'],'sedan',30),
  ('peugeot-307','peugeot','307','307','307',array['307'],'hatchback',40),
  ('peugeot-308','peugeot','308','308','308',array['308'],'hatchback',50),
  ('peugeot-405','peugeot','405','405','405',array['405'],'sedan',60),
  ('peugeot-508','peugeot','508','508','508',array['508'],'sedan',70),
  ('peugeot-partner','peugeot','partner','بارتنر','Partner',array['بارتنر','Partner'],'van',80),

  ('volkswagen-golf','volkswagen','golf','غولف','Golf',array['غولف','جولف','Golf'],'hatchback',10),
  ('volkswagen-passat','volkswagen','passat','باسات','Passat',array['باسات','Passat'],'sedan',20),
  ('volkswagen-polo','volkswagen','polo','بولو','Polo',array['بولو','Polo'],'hatchback',30),
  ('volkswagen-jetta','volkswagen','jetta','جيتا','Jetta',array['جيتا','Jetta'],'sedan',40),
  ('volkswagen-tiguan','volkswagen','tiguan','تيغوان','Tiguan',array['تيغوان','Tiguan'],'suv',50),
  ('volkswagen-transporter','volkswagen','transporter','ترانسبورتر','Transporter',array['ترانسبورتر','Transporter'],'van',60),

  ('audi-a3','audi','a3','A3','A3',array['A3'],'sedan',10),
  ('audi-a4','audi','a4','A4','A4',array['A4'],'sedan',20),
  ('audi-a6','audi','a6','A6','A6',array['A6'],'sedan',30),
  ('audi-q3','audi','q3','Q3','Q3',array['Q3'],'suv',40),
  ('audi-q5','audi','q5','Q5','Q5',array['Q5'],'suv',50),
  ('audi-q7','audi','q7','Q7','Q7',array['Q7'],'suv',60),

  ('mitsubishi-lancer','mitsubishi','lancer','لانسر','Lancer',array['لانسر','Lancer'],'sedan',10),
  ('mitsubishi-pajero','mitsubishi','pajero','باجيرو','Pajero',array['باجيرو','Pajero'],'suv',20),
  ('mitsubishi-outlander','mitsubishi','outlander','أوتلاندر','Outlander',array['اوتلاندر','أوتلاندر','Outlander'],'suv',30),
  ('mitsubishi-l200','mitsubishi','l200','L200','L200',array['L200'],'pickup',40),

  ('mazda-3','mazda','mazda-3','مازدا 3','Mazda 3',array['مازدا3','Mazda3','Mazda 3'],'sedan',10),
  ('mazda-6','mazda','mazda-6','مازدا 6','Mazda 6',array['مازدا6','Mazda6','Mazda 6'],'sedan',20),
  ('mazda-cx-5','mazda','cx-5','CX-5','CX-5',array['CX5','CX-5'],'suv',30),
  ('mazda-cx-9','mazda','cx-9','CX-9','CX-9',array['CX9','CX-9'],'suv',40),
  ('mazda-323','mazda','323','323','323',array['323'],'sedan',50),

  ('suzuki-swift','suzuki','swift','سويفت','Swift',array['سويفت','Swift'],'hatchback',10),
  ('suzuki-celerio','suzuki','celerio','سيليريو','Celerio',array['سيليريو','Celerio'],'hatchback',20),
  ('suzuki-vitara','suzuki','vitara','فيتارا','Vitara',array['فيتارا','Vitara'],'suv',30),
  ('suzuki-grand-vitara','suzuki','grand-vitara','غراند فيتارا','Grand Vitara',array['غراند فيتارا','Grand Vitara'],'suv',40),
  ('suzuki-jimny','suzuki','jimny','جيمني','Jimny',array['جيمني','Jimny'],'suv',50),
  ('suzuki-alto','suzuki','alto','ألتو','Alto',array['التو','ألتو','Alto'],'hatchback',60),

  ('chery-arrizo-5','chery','arrizo-5','أريزو 5','Arrizo 5',array['اريزو 5','أريزو 5','Arrizo 5'],'sedan',10),
  ('chery-tiggo-3','chery','tiggo-3','تيغو 3','Tiggo 3',array['تيغو 3','Tiggo 3'],'suv',20),
  ('chery-tiggo-4','chery','tiggo-4','تيغو 4','Tiggo 4',array['تيغو 4','Tiggo 4'],'suv',30),
  ('chery-tiggo-7','chery','tiggo-7','تيغو 7','Tiggo 7',array['تيغو 7','Tiggo 7'],'suv',40),
  ('chery-tiggo-8','chery','tiggo-8','تيغو 8','Tiggo 8',array['تيغو 8','Tiggo 8'],'suv',50),
  ('chery-qq','chery','qq','QQ','QQ',array['QQ'],'hatchback',60),

  ('geely-emgrand','geely','emgrand','إمجراند','Emgrand',array['امجراند','إمجراند','Emgrand'],'sedan',10),
  ('geely-coolray','geely','coolray','كولراي','Coolray',array['كولراي','Coolray'],'suv',20),
  ('geely-monjaro','geely','monjaro','مونجارو','Monjaro',array['مونجارو','Monjaro'],'suv',30),
  ('geely-geometry-c','geely','geometry-c','جيومتري C','Geometry C',array['جيومتري سي','Geometry C'],'suv',40),

  ('byd-f3','byd','f3','F3','F3',array['F3'],'sedan',10),
  ('byd-qin','byd','qin','تشين','Qin',array['تشين','Qin'],'sedan',20),
  ('byd-song-plus','byd','song-plus','سونغ بلس','Song Plus',array['سونغ بلس','Song Plus'],'suv',30),
  ('byd-yuan-plus','byd','yuan-plus','يوان بلس / أتو 3','Yuan Plus / Atto 3',array['يوان بلس','Atto 3','أتو 3'],'suv',40),
  ('byd-dolphin','byd','dolphin','دولفين','Dolphin',array['دولفين','Dolphin'],'hatchback',50),
  ('byd-seal','byd','seal','سيل','Seal',array['سيل','Seal'],'sedan',60),

  ('lexus-es','lexus','es','ES','ES',array['ES'],'sedan',10),
  ('lexus-is','lexus','is','IS','IS',array['IS'],'sedan',20),
  ('lexus-rx','lexus','rx','RX','RX',array['RX'],'suv',30),
  ('lexus-gx','lexus','gx','GX','GX',array['GX'],'suv',40),
  ('lexus-lx','lexus','lx','LX','LX',array['LX'],'suv',50),

  ('opel-astra','opel','astra','أسترا','Astra',array['استرا','أسترا','Astra'],'hatchback',10),
  ('opel-corsa','opel','corsa','كورسا','Corsa',array['كورسا','Corsa'],'hatchback',20),
  ('opel-vectra','opel','vectra','فيكترا','Vectra',array['فيكترا','Vectra'],'sedan',30),
  ('opel-insignia','opel','insignia','إنسيغنيا','Insignia',array['انسيغنيا','إنسيغنيا','Insignia'],'sedan',40),
  ('opel-zafira','opel','zafira','زافيرا','Zafira',array['زافيرا','Zafira'],'minivan',50),

  ('fiat-tipo','fiat','tipo','تيبو','Tipo',array['تيبو','Tipo'],'sedan',10),
  ('fiat-punto','fiat','punto','بونتو','Punto',array['بونتو','Punto'],'hatchback',20),
  ('fiat-doblo','fiat','doblo','دوبلو','Doblo',array['دوبلو','Doblò','Doblo'],'van',30),
  ('fiat-500','fiat','500','500','500',array['500'],'hatchback',40),

  ('skoda-octavia','skoda','octavia','أوكتافيا','Octavia',array['اوكتافيا','أوكتافيا','Octavia'],'sedan',10),
  ('skoda-fabia','skoda','fabia','فابيا','Fabia',array['فابيا','Fabia'],'hatchback',20),
  ('skoda-superb','skoda','superb','سوبيرب','Superb',array['سوبيرب','Superb'],'sedan',30),
  ('skoda-kodiaq','skoda','kodiaq','كودياك','Kodiaq',array['كودياك','Kodiaq'],'suv',40),

  ('seat-ibiza','seat','ibiza','إيبيزا','Ibiza',array['ايبيزا','إيبيزا','Ibiza'],'hatchback',10),
  ('seat-leon','seat','leon','ليون','Leon',array['ليون','León','Leon'],'hatchback',20),
  ('seat-toledo','seat','toledo','توليدو','Toledo',array['توليدو','Toledo'],'sedan',30),

  ('citroen-c3','citroen','c3','C3','C3',array['C3'],'hatchback',10),
  ('citroen-c4','citroen','c4','C4','C4',array['C4'],'hatchback',20),
  ('citroen-c-elysee','citroen','c-elysee','سي إليزيه','C-Elysee',array['سي اليزيه','C-Elysée','C-Elysee'],'sedan',30),
  ('citroen-berlingo','citroen','berlingo','بيرلينغو','Berlingo',array['بيرلينغو','Berlingo'],'van',40),

  ('daewoo-cielo','daewoo','cielo','سييلو','Cielo',array['سييلو','Cielo'],'sedan',10),
  ('daewoo-lanos','daewoo','lanos','لانوس','Lanos',array['لانوس','Lanos'],'sedan',20),
  ('daewoo-nubira','daewoo','nubira','نوبيرا','Nubira',array['نوبيرا','Nubira'],'sedan',30),
  ('daewoo-matiz','daewoo','matiz','ماتيز','Matiz',array['ماتيز','Matiz'],'hatchback',40),

  ('dodge-charger','dodge','charger','تشارجر','Charger',array['تشارجر','Charger'],'sedan',10),
  ('dodge-challenger','dodge','challenger','تشالنجر','Challenger',array['تشالنجر','Challenger'],'coupe',20),
  ('dodge-durango','dodge','durango','دورانغو','Durango',array['دورانغو','Durango'],'suv',30),
  ('dodge-ram','dodge','ram','رام','Ram',array['رام','Ram'],'pickup',40),

  ('jeep-cherokee','jeep','cherokee','شيروكي','Cherokee',array['شيروكي','Cherokee'],'suv',10),
  ('jeep-grand-cherokee','jeep','grand-cherokee','غراند شيروكي','Grand Cherokee',array['غراند شيروكي','Grand Cherokee'],'suv',20),
  ('jeep-wrangler','jeep','wrangler','رانغلر','Wrangler',array['رانغلر','Wrangler'],'suv',30),
  ('jeep-compass','jeep','compass','كومباس','Compass',array['كومباس','Compass'],'suv',40),

  ('land-rover-discovery','land-rover','discovery','ديسكفري','Discovery',array['ديسكفري','Discovery'],'suv',10),
  ('land-rover-defender','land-rover','defender','ديفندر','Defender',array['ديفندر','Defender'],'suv',20),
  ('land-rover-freelander','land-rover','freelander','فريلاندر','Freelander',array['فريلاندر','Freelander'],'suv',30),
  ('land-rover-range-rover','land-rover','range-rover','رينج روفر','Range Rover',array['رينج روفر','Range Rover'],'suv',40),

  ('gmc-yukon','gmc','yukon','يوكون','Yukon',array['يوكون','Yukon'],'suv',10),
  ('gmc-sierra','gmc','sierra','سييرا','Sierra',array['سييرا','Sierra'],'pickup',20),
  ('gmc-terrain','gmc','terrain','تيرين','Terrain',array['تيرين','Terrain'],'suv',30),
  ('gmc-acadia','gmc','acadia','أكاديا','Acadia',array['اكاديا','أكاديا','Acadia'],'suv',40),

  ('infiniti-q50','infiniti','q50','Q50','Q50',array['Q50'],'sedan',10),
  ('infiniti-qx60','infiniti','qx60','QX60','QX60',array['QX60'],'suv',20),
  ('infiniti-qx80','infiniti','qx80','QX80','QX80',array['QX80'],'suv',30),

  ('subaru-impreza','subaru','impreza','إمبريزا','Impreza',array['امبريزا','إمبريزا','Impreza'],'sedan',10),
  ('subaru-forester','subaru','forester','فورستر','Forester',array['فورستر','Forester'],'suv',20),
  ('subaru-outback','subaru','outback','أوتباك','Outback',array['اوتباك','أوتباك','Outback'],'wagon',30),
  ('subaru-xv','subaru','xv','XV','XV',array['XV'],'suv',40),

  ('isuzu-d-max','isuzu','d-max','دي ماكس','D-Max',array['دي ماكس','D-Max'],'pickup',10),
  ('isuzu-npr','isuzu','npr','NPR','NPR',array['NPR'],'truck',20),

  ('volvo-s60','volvo','s60','S60','S60',array['S60'],'sedan',10),
  ('volvo-s80','volvo','s80','S80','S80',array['S80'],'sedan',20),
  ('volvo-xc60','volvo','xc60','XC60','XC60',array['XC60'],'suv',30),
  ('volvo-xc90','volvo','xc90','XC90','XC90',array['XC90'],'suv',40),

  ('tesla-model-3','tesla','model-3','موديل 3','Model 3',array['موديل 3','Model 3'],'sedan',10),
  ('tesla-model-y','tesla','model-y','موديل Y','Model Y',array['موديل واي','Model Y'],'suv',20),
  ('tesla-model-s','tesla','model-s','موديل S','Model S',array['موديل اس','Model S'],'sedan',30),
  ('tesla-model-x','tesla','model-x','موديل X','Model X',array['موديل اكس','Model X'],'suv',40),

  ('mg-5','mg','5','MG 5','MG 5',array['MG5','MG 5'],'sedan',10),
  ('mg-6','mg','6','MG 6','MG 6',array['MG6','MG 6'],'sedan',20),
  ('mg-zs','mg','zs','ZS','ZS',array['ZS'],'suv',30),
  ('mg-hs','mg','hs','HS','HS',array['HS'],'suv',40),
  ('mg-rx5','mg','rx5','RX5','RX5',array['RX5'],'suv',50),

  ('gac-gs3','gac','gs3','GS3','GS3',array['GS3'],'suv',10),
  ('gac-gs4','gac','gs4','GS4','GS4',array['GS4'],'suv',20),
  ('gac-gs5','gac','gs5','GS5','GS5',array['GS5'],'suv',30),
  ('gac-empow','gac','empow','إمباو','Empow',array['امباو','إمباو','Empow'],'sedan',40),

  ('changan-cs35','changan','cs35','CS35','CS35',array['CS35'],'suv',10),
  ('changan-cs55','changan','cs55','CS55','CS55',array['CS55'],'suv',20),
  ('changan-cs75','changan','cs75','CS75','CS75',array['CS75'],'suv',30),
  ('changan-eado','changan','eado','إيدو','Eado',array['ايدو','إيدو','Eado'],'sedan',40),
  ('changan-alsvin','changan','alsvin','ألسفن','Alsvin',array['السفن','ألسفن','Alsvin'],'sedan',50),

  ('haval-h6','haval','h6','H6','H6',array['H6'],'suv',10),
  ('haval-jolion','haval','jolion','جوليان','Jolion',array['جوليان','Jolion'],'suv',20),
  ('haval-h9','haval','h9','H9','H9',array['H9'],'suv',30),

  ('dongfeng-aeolus-shine','dongfeng','aeolus-shine','أيولوس شاين','Aeolus Shine',array['ايولوس شاين','Aeolus Shine'],'sedan',10),
  ('dongfeng-t5','dongfeng','t5','T5','T5',array['T5'],'suv',20),

  ('lada-niva','lada','niva','نيفا','Niva',array['نيفا','Niva'],'suv',10),
  ('lada-samara','lada','samara','سامارا','Samara',array['سامارا','Samara'],'hatchback',20),
  ('lada-granta','lada','granta','غرانتا','Granta',array['غرانتا','Granta'],'sedan',30),
  ('lada-vesta','lada','vesta','فيستا','Vesta',array['فيستا','Vesta'],'sedan',40),

  ('saipa-pride','saipa','pride','برايد','Pride',array['برايد','Pride'],'sedan',10),
  ('saipa-saina','saipa','saina','ساينا','Saina',array['ساينا','Saina'],'sedan',20),
  ('saipa-quick','saipa','quick','كويك','Quick',array['كويك','Quick'],'hatchback',30),
  ('saipa-shahin','saipa','shahin','شاهين','Shahin',array['شاهين','Shahin'],'sedan',40),

  ('iran-khodro-samand','iran-khodro','samand','سمند','Samand',array['سمند','Samand'],'sedan',10),
  ('iran-khodro-dena','iran-khodro','dena','دنا','Dena',array['دنا','Dena'],'sedan',20),
  ('iran-khodro-tara','iran-khodro','tara','تارا','Tara',array['تارا','Tara'],'sedan',30),
  ('iran-khodro-peugeot-pars','iran-khodro','peugeot-pars','بيجو بارس','Peugeot Pars',array['بيجو بارس','Peugeot Pars'],'sedan',40)
on conflict (id) do update set
  make_id = excluded.make_id,
  slug = excluded.slug,
  name_ar = excluded.name_ar,
  name_en = excluded.name_en,
  aliases = excluded.aliases,
  vehicle_type = excluded.vehicle_type,
  sort_order = excluded.sort_order,
  is_active = true,
  updated_at = now();

comment on table public.vehicle_reference_review_queue is
  'Private deduplicated queue for unknown make/model/generation/trim values. Values are reviewed and matched or created instead of silently becoming permanent free text.';
