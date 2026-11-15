package com.example.demo.repository;

import com.example.demo.entity.DepartmentFee;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface DepartmentFeeRepository
        extends JpaRepository<DepartmentFee, Long> {

    Optional<DepartmentFee> findByDepartmentIgnoreCase(String department);

    boolean existsByDepartmentIgnoreCase(String department);
}