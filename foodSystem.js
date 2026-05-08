// --- 食物系统定义 ---

class FoodItem {
    constructor(x, y, type, duration) {
        this.x = x;
        this.y = y;
        this.type = type; // 'normal', 'gold', 'blue', 'purple', 'bad'(swap), 'reverse_dir'(reverse controls)
        this.duration = duration; // 毫秒，0表示永久(仅用于normal)
        this.maxDuration = duration;
        this.createdAt = Date.now();
        this.isExpired = false;
        
        // 配置颜色
        this.colors = {
            'normal': '#e74c3c', // 红
            'gold': '#f1c40f',   // 金
            'blue': '#3498db',   // 蓝
            'purple': '#9b59b6', // 紫
            'bad': '#5d4037',     // 暗褐色/深棕色 (头尾互换)
            'reverse_dir': '#8e44ad' // 深紫色 (方向反转)
        };
    }

    update() {
        if (this.duration > 0) {
            if (Date.now() - this.createdAt >= this.duration) {
                this.isExpired = true;
            }
        }
    }

    getColor() {
        return this.colors[this.type] || '#fff';
    }
}

class FoodManager {
    constructor(gridCount) {
        this.gridCount = gridCount;
        this.normalFood = null; // 始终存在的一个普通食物
        this.powerFoods = [];   // 能力果实数组
        this.badFoods = [];     // 坏果数组
        
        // 限制数量
        this.MAX_POWER_FOODS = 5;
        this.MAX_BAD_FOODS = 5;
        
        // 坏果刷新计时器ID，用于管理自动刷新
        this.badFoodTimers = []; 
    }

    // 更新网格大小
    setGridCount(count) {
        this.gridCount = count;
    }

    // 生成不冲突的位置
    generatePosition(snake, obstacles, allFoods) {
        let valid = false;
        let pos = { x: 0, y: 0 };
        let attempts = 0;
        
        while (!valid && attempts < 100) {
            pos.x = Math.floor(Math.random() * this.gridCount);
            pos.y = Math.floor(Math.random() * this.gridCount);
            valid = true;
            
            // 检查蛇身
            for (let part of snake) {
                if (part.x === pos.x && part.y === pos.y) { valid = false; break; }
            }
            if (!valid) { attempts++; continue; }

            // 检查障碍物
            for (let obs of obstacles) {
                if (obs.x === pos.x && obs.y === pos.y) { valid = false; break; }
            }
            if (!valid) { attempts++; continue; }

            // 检查其他食物
            if (this.normalFood && this.normalFood.x === pos.x && this.normalFood.y === pos.y) { valid = false; }
            if (!valid) { attempts++; continue; }

            for (let f of allFoods) {
                if (f.x === pos.x && f.y === pos.y) { valid = false; break; }
            }
            if (!valid) { attempts++; continue; }
            
            attempts++;
        }
        return valid ? pos : null;
    }

    // 初始化或重置普通食物
    spawnNormalFood(snake, obstacles) {
        let pos = this.generatePosition(snake, obstacles, [...this.powerFoods, ...this.badFoods]);
        if (pos) {
            this.normalFood = new FoodItem(pos.x, pos.y, 'normal', 0);
        }
    }

    // 尝试生成能力果实
    trySpawnPowerFood(snake, obstacles, score) {
        if (this.powerFoods.length >= this.MAX_POWER_FOODS) return;
        
        // 随机概率生成，这里简化为每次调用有一定概率，或者由外部控制
        // 为了保持游戏节奏，我们可以在主循环中定期调用，或者在吃果子时调用
        // 这里采用：每次吃普通果子时尝试生成一个能力果
        if (Math.random() > 0.3) return; // 30% 概率生成能力果

        let types = ['gold', 'blue', 'purple', 'double']; // 新增 double
        let type = types[Math.floor(Math.random() * types.length)];
        let duration = 5000; // 能力果默认存在5秒

        let pos = this.generatePosition(snake, obstacles, [this.normalFood, ...this.powerFoods, ...this.badFoods]);
        if (pos) {
            this.powerFoods.push(new FoodItem(pos.x, pos.y, type, duration));
        }
    }

    // 处理坏果逻辑
    updateBadFoods(snake, obstacles, score) {
        // 1. 移除过期的坏果
        this.badFoods = this.badFoods.filter(f => !f.isExpired);

        // 2. 计算当前允许的最大坏果数量
        let maxBadCount = 0;
        if (score >= 50) maxBadCount = 5;
        else if (score >= 40) maxBadCount = 3; 
        // 10分: 1个, 3秒
        // 40分: 2个, 4秒 
        // 50分: 3个, 5秒 
        // 后续类推，最多5个，最多7秒
        
        
        let targetCount = 0;
        let duration = 3000;

        if (score < 10) {
            targetCount = 0;
        } else if (score < 40) {
            targetCount = 1;
            duration = 3000;
        } else if (score < 50) {
            targetCount = 2;
            duration = 4000;
        } else if (score < 60) {
            targetCount = 3;
            duration = 5000;
        } else if (score < 70) {
            targetCount = 4;
            duration = 6000;
        } else {
            targetCount = 5;
            duration = 7000;
        }

        // 限制最大5个
        if (targetCount > 5) targetCount = 5;
        if (duration > 7000) duration = 7000;

        // 3. 补充坏果直到达到目标数量 只在数量不足时生成新的
        while (this.badFoods.length < targetCount) {
            let pos = this.generatePosition(snake, obstacles, [this.normalFood, ...this.powerFoods, ...this.badFoods]);
            if (pos) {
                // 50% 概率是头尾互换，50% 是方向反转
                let badType = Math.random() > 0.5 ? 'bad' : 'reverse_dir';
                this.badFoods.push(new FoodItem(pos.x, pos.y, badType, duration));
            } else {
                break; // 没有空间了
            }
        }
    }

    // 获取所有需要渲染的食物
    getAllFoods() {
        let foods = [];
        if (this.normalFood) foods.push(this.normalFood);
        foods.push(...this.powerFoods);
        foods.push(...this.badFoods);
        return foods;
    }

    // 检查碰撞，返回吃到的食物对象，如果没吃到返回 null
    checkCollision(head) {
        // 1. 检查普通食物
        if (this.normalFood && head.x === this.normalFood.x && head.y === this.normalFood.y) {
            let f = this.normalFood;
            this.spawnNormalFood([], []); // 临时参数，实际应在外部重新生成以确保不冲突，这里简化
            return f;
        }

        // 2. 检查能力食物
        for (let i = 0; i < this.powerFoods.length; i++) {
            let f = this.powerFoods[i];
            if (head.x === f.x && head.y === f.y) {
                this.powerFoods.splice(i, 1);
                return f;
            }
        }

        // 3. 检查坏果
        for (let i = 0; i < this.badFoods.length; i++) {
            let f = this.badFoods[i];
            if (head.x === f.x && head.y === f.y) {
                this.badFoods.splice(i, 1);
                return f;
            }
        }

        return null;
    }
    
    // 当地图大小改变时，确保食物在范围内（可选，简单起见暂不处理越界，因为网格数变了坐标可能无效）
    // 最好在 mapUpgrade 时重新生成所有食物
    clearAndRespawn(snake, obstacles) {
        this.normalFood = null;
        this.powerFoods = [];
        this.badFoods = [];
        this.spawnNormalFood(snake, obstacles);
    }
}