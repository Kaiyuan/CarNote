-- CarNote 数据库架构
-- 支持 SQLite 和 PostgreSQL

-- 用户表
CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    email VARCHAR(100),
    nickname VARCHAR(50),
    avatar_url VARCHAR(255),
    role VARCHAR(20) DEFAULT 'user', -- 'admin' or 'user'
    is_disabled BOOLEAN DEFAULT 0, -- 是否禁用
    failed_login_attempts INTEGER DEFAULT 0, -- 登录失败次数
    reset_password_token VARCHAR(100), -- 重置密码令牌
    reset_password_expires TIMESTAMP, -- 令牌过期时间
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 系统设置表
CREATE TABLE IF NOT EXISTS system_settings (
    key VARCHAR(50) PRIMARY KEY,
    value TEXT
);

-- 用户设置表
CREATE TABLE IF NOT EXISTS user_settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    consumption_unit VARCHAR(20) DEFAULT 'L/100km', -- L/100km 或 kWh/100km
    currency VARCHAR(10) DEFAULT 'CNY',
    maintenance_reminder_threshold INTEGER DEFAULT 5000, -- 公里数阈值
    language VARCHAR(10) DEFAULT 'zh-CN',
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- 车辆表 (需先于 api_keys 创建，因为 api_keys 引用它)
CREATE TABLE IF NOT EXISTS vehicles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    plate_number VARCHAR(20) UNIQUE NOT NULL, -- 车牌号
    brand VARCHAR(50), -- 品牌
    model VARCHAR(100), -- 型号
    year INTEGER, -- 年份
    power_type VARCHAR(20) NOT NULL, -- 动力类型: fuel(燃油), electric(纯电), hybrid(混动)
    current_mileage INTEGER DEFAULT 0, -- 当前里程
    photo_url VARCHAR(255), -- 车辆照片
    description TEXT, -- 说明
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- API 密钥表
CREATE TABLE IF NOT EXISTS api_keys (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    key_value VARCHAR(64) UNIQUE NOT NULL,
    key_name VARCHAR(50),
    vehicle_id INTEGER, -- 关联到特定车辆
    is_active BOOLEAN DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE SET NULL
);

-- 能耗记录表
CREATE TABLE IF NOT EXISTS energy_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    log_date TIMESTAMP NOT NULL, -- 记录日期时间
    mileage INTEGER NOT NULL, -- 当前里程
    energy_type VARCHAR(20) NOT NULL, -- 能耗类型: fuel(油) 或 electric(电)
    amount DECIMAL(10, 2) NOT NULL, -- 加油量/充电量 (L 或 kWh)
    cost DECIMAL(10, 2), -- 花费金额
    unit_price DECIMAL(10, 2), -- 单价
    mileage_diff INTEGER, -- 行驶里程差 (自动计算)
    consumption_per_100km DECIMAL(10, 2), -- 百公里消耗 (自动计算)
    fuel_gauge_reading DECIMAL(5, 2), -- 油表/电表读数 (可选, 0-100)
    is_full BOOLEAN DEFAULT 0, -- 是否加满
    location_name VARCHAR(255), -- 补能位置名称
    location_lat DECIMAL(10, 7), -- 纬度
    location_lng DECIMAL(10, 7), -- 经度
    notes TEXT, -- 备注
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 保养/维修记录表
CREATE TABLE IF NOT EXISTS maintenance_records (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    maintenance_date TIMESTAMP NOT NULL, -- 保养日期
    mileage INTEGER NOT NULL, -- 当前里程
    type VARCHAR(50) NOT NULL, -- 项目类型: oil_change(更换机油), brake(刹车片), wash(洗车), etc.
    service_provider VARCHAR(100), -- 服务商/维修店
    cost DECIMAL(10, 2), -- 花费
    description TEXT, -- 服务详情描述
    invoice_url VARCHAR(255), -- 发票照片 URL
    next_maintenance_mileage INTEGER, -- 下次保养里程
    next_maintenance_date DATE, -- 下次保养日期
    status VARCHAR(20) DEFAULT 'completed', -- 状态: pending(待完成), completed(已完成)
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 配件表
CREATE TABLE IF NOT EXISTS parts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    name VARCHAR(100) NOT NULL, -- 配件名称
    part_number VARCHAR(50), -- 配件编号/型号
    installed_date DATE, -- 安装日期
    installed_mileage INTEGER, -- 安装时的里程
    recommended_replacement_mileage INTEGER, -- 建议更换里程
    recommended_replacement_months INTEGER, -- 建议更换月数
    status VARCHAR(20) DEFAULT 'normal', -- 状态: normal(正常), warning(即将过期), expired(需更换)
    photo_url VARCHAR(255), -- 配件图片
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE
);

-- 配件更换记录表
CREATE TABLE IF NOT EXISTS part_replacements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vehicle_id INTEGER NOT NULL,
    part_id INTEGER, -- 关联的配件ID (可选)
    replacement_date DATE NOT NULL, -- 更换日期
    mileage INTEGER NOT NULL, -- 更换时里程
    old_part_name VARCHAR(100), -- 旧配件名称
    new_part_name VARCHAR(100), -- 新配件名称
    part_number VARCHAR(50), -- 配件编号
    cost DECIMAL(10, 2), -- 花费
    service_provider VARCHAR(100), -- 服务商
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (vehicle_id) REFERENCES vehicles(id) ON DELETE CASCADE,
    FOREIGN KEY (part_id) REFERENCES parts(id) ON DELETE SET NULL
);

-- 登录日志表
CREATE TABLE IF NOT EXISTS login_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username VARCHAR(50),
    ip_address VARCHAR(50),
    success BOOLEAN DEFAULT 0,
    attempt_time TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 审计日志表
CREATE TABLE IF NOT EXISTS audit_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER,
    action VARCHAR(50),
    details TEXT,
    ip_address VARCHAR(50),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 共享地点表
CREATE TABLE IF NOT EXISTS shared_locations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR(100),
    address VARCHAR(255),
    latitude DECIMAL(10, 7),
    longitude DECIMAL(10, 7),
    type VARCHAR(20),
    usage_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 公告表
CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    type VARCHAR(20) DEFAULT 'info', -- info, warning, success, danger
    created_by INTEGER NOT NULL,
    is_pinned BOOLEAN DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
);

-- 工单表
CREATE TABLE IF NOT EXISTS tickets (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    user_id INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'open', -- open, in_progress, closed
    priority VARCHAR(20) DEFAULT 'normal', -- low, normal, high, urgent
    category VARCHAR(50),
    admin_response TEXT,
    responded_by INTEGER,
    responded_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (responded_by) REFERENCES users(id) ON DELETE SET NULL
);


-- 创建索引以提高查询性能
CREATE INDEX IF NOT EXISTS idx_vehicles_user_id ON vehicles(user_id);
CREATE INDEX IF NOT EXISTS idx_energy_logs_vehicle_id ON energy_logs(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_energy_logs_date ON energy_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_vehicle_id ON maintenance_records(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_parts_vehicle_id ON parts(vehicle_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_user_id ON api_keys(user_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_key_value ON api_keys(key_value);
