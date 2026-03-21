-- restaurants (block1)
CREATE TABLE restaurants (
    id SERIAL PRIMARY KEY,
    name TEXT,
    address TEXT,
    type TEXT,
    cuisine TEXT,
    avg_check NUMERIC,
    description TEXT,
    link TEXT,
    cosine_score NUMERIC,
    site TEXT,
    delivery BOOLEAN,
    working_hours TEXT
);

-- menus (block2)
CREATE TABLE menus (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id),
    status TEXT,
    menu_urls TEXT[],
    items_count INT,
    has_kids_menu BOOLEAN,
    categories TEXT[]
);

CREATE TABLE menu_items (
    id SERIAL PRIMARY KEY,
    menu_id INT REFERENCES menus(id),
    category TEXT,
    name TEXT,
    price NUMERIC
);

-- reviews (block3)
CREATE TABLE reviews (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id),
    summary_mode TEXT,
    reviews_count INT,
    general_info TEXT,
    positive TEXT,
    negative TEXT
);

-- marketing (block4)
CREATE TABLE marketing (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id),
    site TEXT
);

CREATE TABLE marketing_socials (
    id SERIAL PRIMARY KEY,
    marketing_id INT REFERENCES marketing(id),
    network TEXT,
    url TEXT
);

CREATE TABLE marketing_loyalty (
    id SERIAL PRIMARY KEY,
    marketing_id INT REFERENCES marketing(id),
    has_loyalty BOOLEAN,
    loyalty_name TEXT,
    loyalty_format TEXT,
    loyalty_cost_per_point NUMERIC,
    loyalty_how_to_earn TEXT
);

-- technical_analysis (block5)
CREATE TABLE technical_analysis (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id),
    url TEXT,
    status_code INT,
    load_time_sec NUMERIC,
    mobile_load_time_sec NUMERIC,
    page_size_kb NUMERIC,
    title TEXT,
    meta_description TEXT,
    https BOOLEAN,
    has_viewport BOOLEAN,
    error TEXT
);

-- strategic_report (block6)
CREATE TABLE strategic_report (
    id SERIAL PRIMARY KEY,
    restaurant_id INT REFERENCES restaurants(id),
    block1 TEXT,
    block2 TEXT,
    block3 TEXT,
    block4 TEXT,
    block5 TEXT,
    report_md TEXT,
    positioning TEXT,
    menu TEXT,
    reviews TEXT,
    marketing TEXT,
    technical_part TEXT,
    business_recommendations TEXT,
    reference_info TEXT
);
