/**
 * 数据导入工具类
 */

/**
 * 解析 CSV 字符串为对象数组
 * @param {string} csvText - CSV 内容
 * @param {Object} columnMap - 反向列映射 { label: field }
 */
export const parseCSV = (csvText, columnMap) => {
    const lines = csvText.split('\n').filter(line => line.trim());
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
    const fieldMap = {};

    // 建立索引映射
    headers.forEach((header, index) => {
        if (columnMap[header]) {
            fieldMap[index] = columnMap[header];
        }
    });

    const result = [];
    for (let i = 1; i < lines.length; i++) {
        const cells = parseCSVLine(lines[i]);
        const item = {};
        let hasData = false;

        cells.forEach((cell, index) => {
            const field = fieldMap[index];
            if (field) {
                const value = cell.trim().replace(/^"|"$/g, '').replace(/""/g, '"');
                item[field] = value;
                if (value !== '') hasData = true;
            }
        });

        if (hasData) result.push(item);
    }

    return result;
};

/**
 * 处理包含引号的 CSV 行
 */
function parseCSVLine(line) {
    const result = [];
    let start = 0;
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
        if (line[i] === '"') {
            inQuotes = !inQuotes;
        } else if (line[i] === ',' && !inQuotes) {
            result.push(line.substring(start, i));
            start = i + 1;
        }
    }
    result.push(line.substring(start));
    return result;
}

/**
 * 验证 JSON 备份文件格式
 * @param {Object} data - 数据包
 */
export const validateBackupFormat = (data) => {
    if (!data || typeof data !== 'object') return false;
    // 检查基本结构
    return Array.isArray(data.vehicles) ||
        Array.isArray(data.energyLogs) ||
        Array.isArray(data.maintenanceRecords);
};
